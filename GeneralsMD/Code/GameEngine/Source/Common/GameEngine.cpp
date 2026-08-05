/*
**	Command & Conquer Generals Zero Hour(tm)
**	Copyright 2025 Electronic Arts Inc.
**
**	This program is free software: you can redistribute it and/or modify
**	it under the terms of the GNU General Public License as published by
**	the Free Software Foundation, either version 3 of the License, or
**	(at your option) any later version.
**
**	This program is distributed in the hope that it will be useful,
**	but WITHOUT ANY WARRANTY; without even the implied warranty of
**	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
**	GNU General Public License for more details.
**
**	You should have received a copy of the GNU General Public License
**	along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

////////////////////////////////////////////////////////////////////////////////
//																																						//
//  (c) 2001-2003 Electronic Arts Inc.																				//
//																																						//
////////////////////////////////////////////////////////////////////////////////

// GameEngine.cpp /////////////////////////////////////////////////////////////////////////////////
// Implementation of the Game Engine singleton
// Author: Michael S. Booth, April 2001

#include "PreRTS.h"	// This must go first in EVERY cpp file in the GameEngine

#include <chrono>

#include "Common/ActionManager.h"
#include "Common/AudioAffect.h"
#include "Common/BuildAssistant.h"
#include "Common/CRCDebug.h"
#include "Common/FramePacer.h"
#include "Common/Radar.h"
#include "Common/PlayerTemplate.h"
#include "Common/Team.h"
#include "Common/PlayerList.h"
#include "Common/GameAudio.h"
#include "Common/GameEngine.h"
#include "Common/INI.h"
#include "Common/INIException.h"
#include "Common/MessageStream.h"
#include "Common/ThingFactory.h"
#include "Common/file.h"
#include "Common/FileSystem.h"
#include "Common/ArchiveFileSystem.h"
#include "Common/LocalFileSystem.h"
#include "Common/GlobalData.h"
#include "Common/PerfTimer.h"
#include "Common/RandomValue.h"
#include "Common/NameKeyGenerator.h"
#include "Common/ModuleFactory.h"
#include "Common/Debug.h"
#include "Common/GameState.h"
#include "Common/GameStateMap.h"
#include "Common/Science.h"
#include "Common/FunctionLexicon.h"
#include "Common/CommandLine.h"
#include "Common/DamageFX.h"
#include "Common/MultiplayerSettings.h"
#include "Common/Recorder.h"
#include "Common/SpecialPower.h"
#include "Common/TerrainTypes.h"
#include "Common/Upgrade.h"
#include "Common/OptionPreferences.h"
#include "Common/Xfer.h"
#include "Common/XferCRC.h"
#include "Common/GameLOD.h"
#include "Common/Registry.h"
#include "Common/GameCommon.h"	// FOR THE ALLOW_DEBUG_CHEATS_IN_RELEASE #define

#include "GameLogic/Armor.h"
#include "GameLogic/AI.h"
#include "GameLogic/CaveSystem.h"
#include "GameLogic/CrateSystem.h"
#include "GameLogic/Damage.h"
#include "GameLogic/VictoryConditions.h"
#include "GameLogic/ObjectCreationList.h"
#include "GameLogic/Weapon.h"
#include "GameLogic/GameLogic.h"
#include "GameLogic/Locomotor.h"
#include "GameLogic/RankInfo.h"
#include "GameLogic/ScriptEngine.h"
#include "GameLogic/SidesList.h"

#include "GameClient/ClientInstance.h"
#include "GameClient/FXList.h"
#include "GameClient/GameClient.h"
#include "GameClient/Keyboard.h"
#include "GameClient/Shell.h"
#include "GameClient/GameText.h"
#include "GameClient/ParticleSys.h"
#include "GameClient/Water.h"
#include "GameClient/TerrainRoads.h"
#include "GameClient/MetaEvent.h"
#include "GameClient/MapUtil.h"
#include "GameClient/GameWindowManager.h"
#include "GameClient/GlobalLanguage.h"
#include "GameClient/Drawable.h"
#include "GameClient/GUICallbacks.h"

#include "GameNetwork/NetworkInterface.h"
#include "GameNetwork/WOLBrowser/WebBrowser.h"
#include "GameNetwork/LANAPI.h"
#if defined(SAGE_USE_GAMESPY)
// GeneralsX @build Codex 04/08/2026 Build the results transport only with the matching online backend.
#include "GameNetwork/GameSpy/GameResultsThread.h"
#endif

#include "Common/version.h"


//-------------------------------------------------------------------------------------------------

#ifdef DEBUG_CRC
class DeepCRCSanityCheck : public SubsystemInterface
{
public:
	DeepCRCSanityCheck() {}
	virtual ~DeepCRCSanityCheck() {}

	virtual void init() {}
	virtual void reset();
	virtual void update() {}

protected:
};

DeepCRCSanityCheck *TheDeepCRCSanityCheck = nullptr;

void DeepCRCSanityCheck::reset()
{
	static Int timesThrough = 0;
	static UnsignedInt lastCRC = 0;

	AsciiString fname;
	fname.format("%sCRCAfter%dMaps.dat", TheGlobalData->getPath_UserData().str(), timesThrough);
	UnsignedInt thisCRC = TheGameLogic->getCRC( CRC_RECALC, fname );

	DEBUG_LOG(("DeepCRCSanityCheck: CRC is %X", thisCRC));
	DEBUG_ASSERTCRASH(timesThrough == 0 || thisCRC == lastCRC,
		("CRC after reset did not match beginning CRC!\nNetwork games won't work after this.\nOld: 0x%8.8X, New: 0x%8.8X",
		lastCRC, thisCRC));
	lastCRC = thisCRC;

	timesThrough++;
}
#endif // DEBUG_CRC

//-------------------------------------------------------------------------------------------------
/// The GameEngine singleton instance
GameEngine *TheGameEngine = nullptr;

//-------------------------------------------------------------------------------------------------
SubsystemInterfaceList* TheSubsystemList = nullptr;

//-------------------------------------------------------------------------------------------------
template<class SUBSYSTEM>
void initSubsystem(
	SUBSYSTEM*& sysref,
	AsciiString name,
	SUBSYSTEM* sys,
	Xfer *pXfer,
	const char* path1 = nullptr,
	const char* path2 = nullptr)
{
	sysref = sys;
	TheSubsystemList->initSubsystem(sys, path1, path2, pXfer, name);
}

//-------------------------------------------------------------------------------------------------
extern HINSTANCE ApplicationHInstance;  ///< our application instance
// TheSuperHackers @build fighter19 11/02/2026 COM module (Windows-only)
#ifdef _WIN32
extern CComModule _Module;
#endif

//-------------------------------------------------------------------------------------------------
static void updateTGAtoDDS();

//-------------------------------------------------------------------------------------------------
static void updateWindowTitle()
{
	// TheSuperHackers @tweak Now prints product and version information in the Window title.

	DEBUG_ASSERTCRASH(TheVersion != nullptr, ("TheVersion is null"));
	DEBUG_ASSERTCRASH(TheGameText != nullptr, ("TheGameText is null"));

	UnicodeString title;

	if (rts::ClientInstance::getInstanceId() > 1u)
	{
		UnicodeString str;
		str.format(L"Instance:%.2u", rts::ClientInstance::getInstanceId());
		title.concat(str);
	}

	UnicodeString productString = TheVersion->getUnicodeProductString();

	if (!productString.isEmpty())
	{
		if (!title.isEmpty())
			title.concat(L" ");
		title.concat(productString);
	}

#if RTS_GENERALS
	const WideChar* defaultGameTitle = L"Command and Conquer Generals";
#elif RTS_ZEROHOUR
	const WideChar* defaultGameTitle = L"Command and Conquer Generals Zero Hour";
#endif
	UnicodeString gameTitle = TheGameText->FETCH_OR_SUBSTITUTE("GUI:Command&ConquerGenerals", defaultGameTitle);

	if (!gameTitle.isEmpty())
	{
		UnicodeString gameTitleFinal;
		UnicodeString gameVersion = TheVersion->getUnicodeVersion();

		if (productString.isEmpty())
		{
			gameTitleFinal = gameTitle;
		}
		else
		{
			UnicodeString gameTitleFormat = TheGameText->FETCH_OR_SUBSTITUTE("Version:GameTitle", L"for %ls");
			gameTitleFinal.format(gameTitleFormat.str(), gameTitle.str());
		}

		if (!title.isEmpty())
			title.concat(L" ");
		title.concat(gameTitleFinal.str());
		title.concat(L" ");
		title.concat(gameVersion.str());
	}

	if (!title.isEmpty())
	{
		AsciiString titleA;
		titleA.translate(title);	//get ASCII version for Win 9x

		extern HWND ApplicationHWnd;  ///< our application window handle
		if (ApplicationHWnd) {
// TheSuperHackers @build fighter19 11/02/2026 SetWindowText is Windows-only
#ifdef _WIN32
			//Set it twice because Win 9x does not support SetWindowTextW.
			::SetWindowText(ApplicationHWnd, titleA.str());
			::SetWindowTextW(ApplicationHWnd, title.str());
#else
			// Linux: SDL3 handles window title (set via SDL_SetWindowTitle if needed)
#endif
		}
	}
}

//-------------------------------------------------------------------------------------------------
GameEngine::GameEngine()
{
	// initialize to non garbage values
	m_logicTimeAccumulator = 0.0f;
	m_botMatchStartCounter = 0;
	m_botMatchDrawCalls = 0;
	m_botMatchFrameMilliseconds = 0.0;
	m_botMatchMaxFrameMilliseconds = 0.0;
	m_botMatchRenderFrames = 0;
	m_botMatchMaxDrawCalls = 0;
	m_botMatchResultEmitted = FALSE;
	m_quitting = FALSE;
	m_isActive = FALSE;

// TheSuperHackers @build fighter19 11/02/2026 COM initialization (Windows-only)
#ifdef _WIN32
	_Module.Init(nullptr, ApplicationHInstance, nullptr);
#endif
}

static void startCommandLineBotMatch()
{
	if (TheCommandLineBotMatchMap[0] == '\0')
		return;

	AsciiString mapName = TheCommandLineBotMatchMap;
	AsciiString mapKey = mapName;
	mapKey.toLower();
	MapCache::const_iterator map = TheMapCache->find(mapKey);
	if (map == TheMapCache->end() || !map->second.m_isMultiplayer || map->second.m_numPlayers < 2)
	{
		AsciiString error;
		error.format("Invalid bot-match map: %s", mapName.str());
		RELEASE_CRASH(error.str());
		return;
	}

	const Int faction = ThePlayerTemplateStore->getTemplateNumByName(TheCommandLineBotMatchFaction);
	if (faction < 0)
	{
		AsciiString error;
		error.format("Invalid bot-match faction: %s", TheCommandLineBotMatchFaction);
		RELEASE_CRASH(error.str());
		return;
	}

	delete TheSkirmishGameInfo;
	TheSkirmishGameInfo = NEW SkirmishGameInfo;
	TheSkirmishGameInfo->init();
	TheSkirmishGameInfo->clearSlotList();
	TheSkirmishGameInfo->reset();
	const UnsignedInt localIP = 0x7f000001;
	TheSkirmishGameInfo->setLocalIP(localIP);
	TheSkirmishGameInfo->enterGame();

	UnicodeString observerName;
	observerName.translate("GeneralsX Observer");
	GameSlot observer;
	observer.setState(SLOT_PLAYER, observerName, localIP);
	observer.setPlayerTemplate(PLAYERTEMPLATE_OBSERVER);
	TheSkirmishGameInfo->setSlot(0, observer);

	for (Int slotIndex = 1; slotIndex <= 2; ++slotIndex)
	{
		GameSlot bot;
		bot.setState(SLOT_BRUTAL_AI);
		bot.setPlayerTemplate(faction);
		bot.setColor(slotIndex - 1);
		bot.setStartPos(slotIndex - 1);
		bot.setTeamNumber(-1);
		TheSkirmishGameInfo->setSlot(slotIndex, bot);
	}

	TheSkirmishGameInfo->setSeed(TheCommandLineBotMatchSeed);
	TheSkirmishGameInfo->setMap(mapName);
	TheSkirmishGameInfo->setMapCRC(map->second.m_CRC);
	TheSkirmishGameInfo->setMapSize(map->second.m_filesize);
	TheSkirmishGameInfo->startGame(0);

	TheGameLODManager->setStaticLODLevel(STATIC_GAME_LOD_VERY_HIGH);
	TheWritableGlobalData->m_enableDynamicLOD = FALSE;
	TheWritableGlobalData->m_mapName = mapName;
	InitRandom(TheCommandLineBotMatchSeed);
	GameMessage *msg = TheMessageStream->appendMessage(GameMessage::MSG_NEW_GAME);
	msg->appendIntegerArgument(GAME_SKIRMISH);
	msg->appendIntegerArgument(DIFFICULTY_HARD);
	msg->appendIntegerArgument(0);
	msg->appendIntegerArgument(LOGICFRAMES_PER_SECOND * TheCommandLineBotMatchSpeed);
	fprintf(stderr,
		"GENERALSX_BOT_MATCH_CONFIG {\"map\":\"%s\",\"faction\":\"%s\",\"difficulty\":\"brutal\",\"seed\":%u,\"maxFrames\":%u,\"speed\":%u,\"lod\":\"VeryHigh\"}\n",
		TheCommandLineBotMatchMap, TheCommandLineBotMatchFaction, TheCommandLineBotMatchSeed,
		TheCommandLineBotMatchMaxFrames, TheCommandLineBotMatchSpeed);
}

static Int64 getBotMatchCounter()
{
	return std::chrono::duration_cast<std::chrono::microseconds>(
		std::chrono::steady_clock::now().time_since_epoch()).count();
}

//-------------------------------------------------------------------------------------------------
GameEngine::~GameEngine()
{
	//extern std::vector<std::string>	preloadTextureNamesGlobalHack;
	//preloadTextureNamesGlobalHack.clear();

	delete TheMapCache;
	TheMapCache = nullptr;

//	delete TheShell;
//	TheShell = nullptr;

#if defined(SAGE_USE_GAMESPY)
	TheGameResultsQueue->endThreads();
#endif

	// TheSuperHackers @fix helmutbuhler 03/06/2025
	// Reset all subsystems before deletion to prevent crashing due to cross dependencies.
	reset();

	TheSubsystemList->shutdownAll();
	delete TheSubsystemList;
	TheSubsystemList = nullptr;

	delete TheSkirmishGameInfo;
	TheSkirmishGameInfo = nullptr;

	delete TheChallengeGameInfo;
	TheChallengeGameInfo = nullptr;

	delete TheNetwork;
	TheNetwork = nullptr;

	delete TheCommandList;
	TheCommandList = nullptr;

	delete TheNameKeyGenerator;
	TheNameKeyGenerator = nullptr;

	delete TheFileSystem;
	TheFileSystem = nullptr;

	delete TheGameLODManager;
	TheGameLODManager = nullptr;

	Drawable::killStaticImages();

// TheSuperHackers @build fighter19 11/02/2026 COM termination (Windows-only)
#ifdef _WIN32
	_Module.Term();
#endif

#ifdef PERF_TIMERS
	PerfGather::termPerfDump();
#endif
}

//-------------------------------------------------------------------------------------------------
Bool GameEngine::isTimeFrozen()
{
	// TheSuperHackers @fix The time can no longer be frozen in Network games. It would disconnect the player.
	if (TheNetwork != nullptr)
		return false;

	if (TheTacticalView != nullptr)
	{
		if (TheTacticalView->isTimeFrozen() && !TheTacticalView->isCameraMovementFinished())
			return true;
	}

	if (TheScriptEngine != nullptr)
	{
		if (TheScriptEngine->isTimeFrozenDebug() || TheScriptEngine->isTimeFrozenScript())
			return true;
	}

	return false;
}

//-------------------------------------------------------------------------------------------------
Bool GameEngine::isGameHalted()
{
	if (TheNetwork != nullptr)
	{
		if (TheNetwork->isStalling())
			return true;
	}
	else
	{
		if (TheGameLogic != nullptr && TheGameLogic->isGamePaused())
			return true;
	}

	return false;
}

/** -----------------------------------------------------------------------------------------------
 * Initialize the game engine by initializing the GameLogic and GameClient.
 */
void GameEngine::init()
{
	try {
		//create an INI object to use for loading stuff
		INI ini;

#ifdef DEBUG_LOGGING
		if (TheVersion)
		{
			DEBUG_LOG(("================================================================================"));
			DEBUG_LOG(("Generals version %s", TheVersion->getAsciiVersion().str()));
			DEBUG_LOG(("Build date: %s", TheVersion->getAsciiBuildTime().str()));
			DEBUG_LOG(("Build location: %s", TheVersion->getAsciiBuildLocation().str()));
			DEBUG_LOG(("Build user: %s", TheVersion->getAsciiBuildUser().str()));
			DEBUG_LOG(("Build git revision: %s", TheVersion->getAsciiGitCommitCount().str()));
			DEBUG_LOG(("Build git version: %s", TheVersion->getAsciiGitTagOrHash().str()));
			DEBUG_LOG(("Build git commit time: %s", TheVersion->getAsciiGitCommitTime().str()));
			DEBUG_LOG(("Build git commit author: %s", Version::getGitCommitAuthorName()));
			DEBUG_LOG(("================================================================================"));
		}
#endif

	#if defined(PERF_TIMERS) || defined(DUMP_PERF_STATS)
		DEBUG_LOG(("Calculating CPU frequency for performance timers."));
		InitPrecisionTimer();
	#endif
	#ifdef PERF_TIMERS
		PerfGather::initPerfDump("AAAPerfStats", PerfGather::PERF_NETTIME);
	#endif




	#ifdef DUMP_PERF_STATS////////////////////////////////////////////////////////////
	__int64 startTime64;//////////////////////////////////////////////////////////////
	__int64 endTime64,freq64;///////////////////////////////////////////////////////////
	GetPrecisionTimerTicksPerSec(&freq64);///////////////////////////////////////////////
	GetPrecisionTimer(&startTime64);////////////////////////////////////////////////////
  char Buf[256];//////////////////////////////////////////////////////////////////////
	#endif//////////////////////////////////////////////////////////////////////////////


		TheSubsystemList = MSGNEW("GameEngineSubsystem") SubsystemInterfaceList;

		TheSubsystemList->addSubsystem(this);

		// initialize the random number system
		InitRandom();

		// Create the low-level file system interface
		TheFileSystem = createFileSystem();

		// not part of the subsystem list, because it should normally never be reset!
		TheNameKeyGenerator = MSGNEW("GameEngineSubsystem") NameKeyGenerator;
		TheNameKeyGenerator->init();


    	#ifdef DUMP_PERF_STATS///////////////////////////////////////////////////////////////////////////
	GetPrecisionTimer(&endTime64);//////////////////////////////////////////////////////////////////
	sprintf(Buf,"----------------------------------------------------------------------------After TheNameKeyGenerator  = %f seconds",((double)(endTime64-startTime64)/(double)(freq64)));
  startTime64 = endTime64;//Reset the clock ////////////////////////////////////////////////////////
	DEBUG_LOG(("%s", Buf));////////////////////////////////////////////////////////////////////////////
	#endif/////////////////////////////////////////////////////////////////////////////////////////////


		// not part of the subsystem list, because it should normally never be reset!
		TheCommandList = MSGNEW("GameEngineSubsystem") CommandList;
		TheCommandList->init();

    	#ifdef DUMP_PERF_STATS///////////////////////////////////////////////////////////////////////////
	GetPrecisionTimer(&endTime64);//////////////////////////////////////////////////////////////////
	sprintf(Buf,"----------------------------------------------------------------------------After TheCommandList  = %f seconds",((double)(endTime64-startTime64)/(double)(freq64)));
  startTime64 = endTime64;//Reset the clock ////////////////////////////////////////////////////////
	DEBUG_LOG(("%s", Buf));////////////////////////////////////////////////////////////////////////////
	#endif/////////////////////////////////////////////////////////////////////////////////////////////


		XferCRC xferCRC;
		xferCRC.open("lightCRC");


		initSubsystem(TheLocalFileSystem, "TheLocalFileSystem", createLocalFileSystem(), nullptr);


    	#ifdef DUMP_PERF_STATS///////////////////////////////////////////////////////////////////////////
	GetPrecisionTimer(&endTime64);//////////////////////////////////////////////////////////////////
	sprintf(Buf,"----------------------------------------------------------------------------After TheLocalFileSystem  = %f seconds",((double)(endTime64-startTime64)/(double)(freq64)));
  startTime64 = endTime64;//Reset the clock ////////////////////////////////////////////////////////
	DEBUG_LOG(("%s", Buf));////////////////////////////////////////////////////////////////////////////
	#endif/////////////////////////////////////////////////////////////////////////////////////////////


		initSubsystem(TheArchiveFileSystem, "TheArchiveFileSystem", createArchiveFileSystem(), nullptr); // this MUST come after TheLocalFileSystem creation

    	#ifdef DUMP_PERF_STATS///////////////////////////////////////////////////////////////////////////
	GetPrecisionTimer(&endTime64);//////////////////////////////////////////////////////////////////
	sprintf(Buf,"----------------------------------------------------------------------------After TheArchiveFileSystem  = %f seconds",((double)(endTime64-startTime64)/(double)(freq64)));
  startTime64 = endTime64;//Reset the clock ////////////////////////////////////////////////////////
	DEBUG_LOG(("%s", Buf));////////////////////////////////////////////////////////////////////////////
	#endif/////////////////////////////////////////////////////////////////////////////////////////////


		DEBUG_ASSERTCRASH(TheWritableGlobalData,("TheWritableGlobalData expected to be created"));
	initSubsystem(TheWritableGlobalData, "TheWritableGlobalData", TheWritableGlobalData, &xferCRC, "Data\\INI\\Default\\GameData", "Data\\INI\\GameData");
	TheWritableGlobalData->parseCustomDefinition();

	// GeneralsX @feature felipebraz 08/06/2026 Auto-create SagePatch.ini in user data dir with defaults.
	// This replaces the run.sh copy approach with engine-managed defaults.
	{
		AsciiString sagePatchPath = TheWritableGlobalData->getPath_UserData();
		sagePatchPath.concat("SagePatch.ini");

		if (!TheLocalFileSystem->doesFileExist(sagePatchPath.str()))
		{
			FILE *f = fopen(sagePatchPath.str(), "w");
			if (f)
			{
				fprintf(f,
				"; -----------------------------------------------------------------------------\n"
				"; SagePatch - Casual QoL overrides for GeneralsX\n"
				";\n"
				"; Loaded by the engine after the BIG-archived Data/INI/GameData.ini, so values\n"
				"; here override (not append to) the originals.\n"
				"; -----------------------------------------------------------------------------\n"
				"\n"
				"GameData\n"
				"  ; Slightly higher than vanilla (310); further out without seeing past the map border.\n"
				"  MaxCameraHeight = 350.0\n"
				"  ; Slightly lower than vanilla (120) so casual zoom-in feels useful.\n"
				"  MinCameraHeight = 100.0\n"
					"  ; Still soft-disabled so the user can push past max without a hard clamp.\n"
					"  EnforceMaxCameraHeight = No\n"
					"  ; Keyboard scroll - vanilla 0.5 is sluggish, double it.\n"
					"  KeyboardScrollSpeedFactor = 1.0\n"
					"  ; ~5% more terrain drawn at max zoom to fix terrain pop-in.\n"
					"  TerrainDrawDistanceScale = 1.05\n"
					// GeneralsX @tweak felipebraz 20/06/2026 Default render FPS limit to 60 FPS in SagePatch.ini
					"  UseFPSLimit = Yes\n"
					"  FramesPerSecondLimit = 60\n"
					"End\n"
				);
				fclose(f);
			}
		}

		if (TheLocalFileSystem->doesFileExist(sagePatchPath.str()))
		{
			// Check and migrate existing SagePatch.ini for 60 FPS
			FILE *f = fopen(sagePatchPath.str(), "rb");
			if (f)
			{
				fseek(f, 0, SEEK_END);
				long size = ftell(f);
				fseek(f, 0, SEEK_SET);
				char *buffer = new char[size + 1];
				fread(buffer, 1, size, f);
				buffer[size] = 0;
				fclose(f);

				if (!strstr(buffer, "FramesPerSecondLimit"))
				{
					char *endPos = strstr(buffer, "End");
					if (endPos != nullptr)
					{
						*endPos = '\0';
						FILE *fw = fopen(sagePatchPath.str(), "wb");
						if (fw)
						{
							fprintf(fw, "%s  ; Migrated 60 FPS defaults\n  UseFPSLimit = Yes\n  FramesPerSecondLimit = 60\nEnd\n", buffer);
							fclose(fw);
						}
					}
				}
				delete[] buffer;
			}

			ini.load(sagePatchPath, INI_LOAD_OVERWRITE, nullptr);
		}
	}

	#ifdef DUMP_PERF_STATS///////////////////////////////////////////////////////////////////////////
	GetPrecisionTimer(&endTime64);//////////////////////////////////////////////////////////////////
	sprintf(Buf,"----------------------------------------------------------------------------After  TheWritableGlobalData = %f seconds",((double)(endTime64-startTime64)/(double)(freq64)));
  startTime64 = endTime64;//Reset the clock ////////////////////////////////////////////////////////
	DEBUG_LOG(("%s", Buf));////////////////////////////////////////////////////////////////////////////
	#endif/////////////////////////////////////////////////////////////////////////////////////////////



	#if defined(RTS_DEBUG)
		// If we're in Debug, load the Debug settings as well.
		ini.loadFileDirectory( "Data\\INI\\GameDataDebug", INI_LOAD_OVERWRITE, nullptr );
	#endif

		// special-case: parse command-line parameters after loading global data
		CommandLine::parseCommandLineForEngineInit();

		TheArchiveFileSystem->loadMods();

		// doesn't require resets so just create a single instance here.
		TheGameLODManager = MSGNEW("GameEngineSubsystem") GameLODManager;
		TheGameLODManager->init();

		// after parsing the command line, we may want to perform dds stuff. Do that here.
		if (TheGlobalData->m_shouldUpdateTGAToDDS) {
			// update any out of date targas here.
			updateTGAtoDDS();
		}

		// read the water settings from INI (must do prior to initing GameClient, apparently)
		ini.loadFileDirectory( "Data\\INI\\Default\\Water", INI_LOAD_OVERWRITE, &xferCRC );
		ini.loadFileDirectory( "Data\\INI\\Water", INI_LOAD_OVERWRITE, &xferCRC );
		ini.loadFileDirectory( "Data\\INI\\Default\\Weather", INI_LOAD_OVERWRITE, &xferCRC );
		ini.loadFileDirectory( "Data\\INI\\Weather", INI_LOAD_OVERWRITE, &xferCRC );



	#ifdef DUMP_PERF_STATS///////////////////////////////////////////////////////////////////////////
	GetPrecisionTimer(&endTime64);//////////////////////////////////////////////////////////////////
	sprintf(Buf,"----------------------------------------------------------------------------After water INI's = %f seconds",((double)(endTime64-startTime64)/(double)(freq64)));
  startTime64 = endTime64;//Reset the clock ////////////////////////////////////////////////////////
	DEBUG_LOG(("%s", Buf));////////////////////////////////////////////////////////////////////////////
	#endif/////////////////////////////////////////////////////////////////////////////////////////////


#ifdef DEBUG_CRC
		initSubsystem(TheDeepCRCSanityCheck, "TheDeepCRCSanityCheck", MSGNEW("GameEngineSubystem") DeepCRCSanityCheck, nullptr);
#endif // DEBUG_CRC
		initSubsystem(TheGameText, "TheGameText", CreateGameTextInterface(), nullptr);
		updateWindowTitle();

	#ifdef DUMP_PERF_STATS///////////////////////////////////////////////////////////////////////////
	GetPrecisionTimer(&endTime64);//////////////////////////////////////////////////////////////////
	sprintf(Buf,"----------------------------------------------------------------------------After TheGameText = %f seconds",((double)(endTime64-startTime64)/(double)(freq64)));
  startTime64 = endTime64;//Reset the clock ////////////////////////////////////////////////////////
	DEBUG_LOG(("%s", Buf));////////////////////////////////////////////////////////////////////////////
	#endif/////////////////////////////////////////////////////////////////////////////////////////////


#if RETAIL_COMPATIBLE_CRC
		if (xferCRC.getCRC() == 0xA1E7F8E6)
			TheNameKeyGenerator->verifyNameKeyID(1);
#endif

		initSubsystem(TheScienceStore,"TheScienceStore", MSGNEW("GameEngineSubsystem") ScienceStore(), &xferCRC, "Data\\INI\\Default\\Science", "Data\\INI\\Science");
		initSubsystem(TheMultiplayerSettings,"TheMultiplayerSettings", MSGNEW("GameEngineSubsystem") MultiplayerSettings(), &xferCRC, "Data\\INI\\Default\\Multiplayer", "Data\\INI\\Multiplayer");
		initSubsystem(TheTerrainTypes,"TheTerrainTypes", MSGNEW("GameEngineSubsystem") TerrainTypeCollection(), &xferCRC, "Data\\INI\\Default\\Terrain", "Data\\INI\\Terrain");
		initSubsystem(TheTerrainRoads,"TheTerrainRoads", MSGNEW("GameEngineSubsystem") TerrainRoadCollection(), &xferCRC, "Data\\INI\\Default\\Roads", "Data\\INI\\Roads");
		initSubsystem(TheGlobalLanguageData,"TheGlobalLanguageData",MSGNEW("GameEngineSubsystem") GlobalLanguage, nullptr); // must be before the game text
		TheGlobalLanguageData->parseCustomDefinition();
	#ifdef DUMP_PERF_STATS///////////////////////////////////////////////////////////////////////////
	GetPrecisionTimer(&endTime64);//////////////////////////////////////////////////////////////////
	sprintf(Buf,"----------------------------------------------------------------------------After TheGlobalLanguageData = %f seconds",((double)(endTime64-startTime64)/(double)(freq64)));
  startTime64 = endTime64;//Reset the clock ////////////////////////////////////////////////////////
	DEBUG_LOG(("%s", Buf));////////////////////////////////////////////////////////////////////////////
	#endif/////////////////////////////////////////////////////////////////////////////////////////////
		initSubsystem(TheAudio,"TheAudio", createAudioManager(TheGlobalData->m_headless), nullptr);
		if (!TheAudio->isMusicAlreadyLoaded())
			setQuitting(TRUE);

#if RTS_ZEROHOUR && RETAIL_COMPATIBLE_CRC
		TheNameKeyGenerator->syncNameKeyID();
#endif

	#ifdef DUMP_PERF_STATS///////////////////////////////////////////////////////////////////////////
	GetPrecisionTimer(&endTime64);//////////////////////////////////////////////////////////////////
	sprintf(Buf,"----------------------------------------------------------------------------After TheAudio = %f seconds",((double)(endTime64-startTime64)/(double)(freq64)));
  startTime64 = endTime64;//Reset the clock ////////////////////////////////////////////////////////
	DEBUG_LOG(("%s", Buf));////////////////////////////////////////////////////////////////////////////
	#endif/////////////////////////////////////////////////////////////////////////////////////////////


		initSubsystem(TheFunctionLexicon,"TheFunctionLexicon", createFunctionLexicon(), nullptr);
		initSubsystem(TheModuleFactory,"TheModuleFactory", createModuleFactory(), nullptr);
		initSubsystem(TheMessageStream,"TheMessageStream", createMessageStream(), nullptr);
		initSubsystem(TheSidesList,"TheSidesList", MSGNEW("GameEngineSubsystem") SidesList(), nullptr);
		initSubsystem(TheCaveSystem,"TheCaveSystem", MSGNEW("GameEngineSubsystem") CaveSystem(), nullptr);
		initSubsystem(TheRankInfoStore,"TheRankInfoStore", MSGNEW("GameEngineSubsystem") RankInfoStore(), &xferCRC, nullptr, "Data\\INI\\Rank");
		initSubsystem(ThePlayerTemplateStore,"ThePlayerTemplateStore", MSGNEW("GameEngineSubsystem") PlayerTemplateStore(), &xferCRC, "Data\\INI\\Default\\PlayerTemplate", "Data\\INI\\PlayerTemplate");
		initSubsystem(TheParticleSystemManager,"TheParticleSystemManager", createParticleSystemManager(TheGlobalData->m_headless), nullptr);

	#ifdef DUMP_PERF_STATS///////////////////////////////////////////////////////////////////////////
	GetPrecisionTimer(&endTime64);//////////////////////////////////////////////////////////////////
	sprintf(Buf,"----------------------------------------------------------------------------After TheParticleSystemManager = %f seconds",((double)(endTime64-startTime64)/(double)(freq64)));
  startTime64 = endTime64;//Reset the clock ////////////////////////////////////////////////////////
	DEBUG_LOG(("%s", Buf));////////////////////////////////////////////////////////////////////////////
	#endif/////////////////////////////////////////////////////////////////////////////////////////////


		initSubsystem(TheFXListStore,"TheFXListStore", MSGNEW("GameEngineSubsystem") FXListStore(), &xferCRC, "Data\\INI\\Default\\FXList", "Data\\INI\\FXList");
		initSubsystem(TheWeaponStore,"TheWeaponStore", MSGNEW("GameEngineSubsystem") WeaponStore(), &xferCRC, nullptr, "Data\\INI\\Weapon");
		initSubsystem(TheObjectCreationListStore,"TheObjectCreationListStore", MSGNEW("GameEngineSubsystem") ObjectCreationListStore(), &xferCRC, "Data\\INI\\Default\\ObjectCreationList", "Data\\INI\\ObjectCreationList");
		initSubsystem(TheLocomotorStore,"TheLocomotorStore", MSGNEW("GameEngineSubsystem") LocomotorStore(), &xferCRC, nullptr, "Data\\INI\\Locomotor");
		initSubsystem(TheSpecialPowerStore,"TheSpecialPowerStore", MSGNEW("GameEngineSubsystem") SpecialPowerStore(), &xferCRC, "Data\\INI\\Default\\SpecialPower", "Data\\INI\\SpecialPower");
		initSubsystem(TheDamageFXStore,"TheDamageFXStore", MSGNEW("GameEngineSubsystem") DamageFXStore(), &xferCRC, nullptr, "Data\\INI\\DamageFX");
		initSubsystem(TheArmorStore,"TheArmorStore", MSGNEW("GameEngineSubsystem") ArmorStore(), &xferCRC, nullptr, "Data\\INI\\Armor");
		initSubsystem(TheBuildAssistant,"TheBuildAssistant", MSGNEW("GameEngineSubsystem") BuildAssistant, nullptr);


	#ifdef DUMP_PERF_STATS///////////////////////////////////////////////////////////////////////////
	GetPrecisionTimer(&endTime64);//////////////////////////////////////////////////////////////////
	sprintf(Buf,"----------------------------------------------------------------------------After TheBuildAssistant = %f seconds",((double)(endTime64-startTime64)/(double)(freq64)));
  startTime64 = endTime64;//Reset the clock ////////////////////////////////////////////////////////
	DEBUG_LOG(("%s", Buf));////////////////////////////////////////////////////////////////////////////
	#endif/////////////////////////////////////////////////////////////////////////////////////////////



		initSubsystem(TheThingFactory,"TheThingFactory", createThingFactory(), &xferCRC, "Data\\INI\\Default\\Object", "Data\\INI\\Object");

	#ifdef DUMP_PERF_STATS///////////////////////////////////////////////////////////////////////////
	GetPrecisionTimer(&endTime64);//////////////////////////////////////////////////////////////////
	sprintf(Buf,"----------------------------------------------------------------------------After TheThingFactory = %f seconds",((double)(endTime64-startTime64)/(double)(freq64)));
  startTime64 = endTime64;//Reset the clock ////////////////////////////////////////////////////////
	DEBUG_LOG(("%s", Buf));////////////////////////////////////////////////////////////////////////////
	#endif/////////////////////////////////////////////////////////////////////////////////////////////


#if RETAIL_COMPATIBLE_CRC
		if (xferCRC.getCRC() == 0x6209AF6E)
			TheNameKeyGenerator->verifyNameKeyID(2265);
#endif

		initSubsystem(TheUpgradeCenter,"TheUpgradeCenter", MSGNEW("GameEngineSubsystem") UpgradeCenter, &xferCRC, "Data\\INI\\Default\\Upgrade", "Data\\INI\\Upgrade");
		initSubsystem(TheGameClient,"TheGameClient", createGameClient(), nullptr);


	#ifdef DUMP_PERF_STATS///////////////////////////////////////////////////////////////////////////
	GetPrecisionTimer(&endTime64);//////////////////////////////////////////////////////////////////
	sprintf(Buf,"----------------------------------------------------------------------------After TheGameClient = %f seconds",((double)(endTime64-startTime64)/(double)(freq64)));
  startTime64 = endTime64;//Reset the clock ////////////////////////////////////////////////////////
	DEBUG_LOG(("%s", Buf));////////////////////////////////////////////////////////////////////////////
	#endif/////////////////////////////////////////////////////////////////////////////////////////////


		initSubsystem(TheAI,"TheAI", MSGNEW("GameEngineSubsystem") AI(), &xferCRC,  "Data\\INI\\Default\\AIData", "Data\\INI\\AIData");
		initSubsystem(TheGameLogic,"TheGameLogic", createGameLogic(), nullptr);
		initSubsystem(TheTeamFactory,"TheTeamFactory", MSGNEW("GameEngineSubsystem") TeamFactory(), nullptr);
		initSubsystem(TheCrateSystem,"TheCrateSystem", MSGNEW("GameEngineSubsystem") CrateSystem(), &xferCRC, "Data\\INI\\Default\\Crate", "Data\\INI\\Crate");
		initSubsystem(ThePlayerList,"ThePlayerList", MSGNEW("GameEngineSubsystem") PlayerList(), nullptr);
		initSubsystem(TheRecorder,"TheRecorder", createRecorder(), nullptr);
		initSubsystem(TheRadar,"TheRadar", createRadar(TheGlobalData->m_headless), nullptr);
		initSubsystem(TheVictoryConditions,"TheVictoryConditions", createVictoryConditions(), nullptr);



	#ifdef DUMP_PERF_STATS///////////////////////////////////////////////////////////////////////////
	GetPrecisionTimer(&endTime64);//////////////////////////////////////////////////////////////////
	sprintf(Buf,"----------------------------------------------------------------------------After TheVictoryConditions = %f seconds",((double)(endTime64-startTime64)/(double)(freq64)));
  startTime64 = endTime64;//Reset the clock ////////////////////////////////////////////////////////
	DEBUG_LOG(("%s", Buf));////////////////////////////////////////////////////////////////////////////
	#endif/////////////////////////////////////////////////////////////////////////////////////////////


		AsciiString fname;
		fname.format("Data\\%s\\CommandMap", GetRegistryLanguage().str());
		initSubsystem(TheMetaMap,"TheMetaMap", MSGNEW("GameEngineSubsystem") MetaMap(), nullptr, fname.str(), "Data\\INI\\CommandMap");

#if defined(RTS_DEBUG)
		ini.loadFileDirectory("Data\\INI\\CommandMapDebug", INI_LOAD_MULTIFILE, nullptr);
#endif

#if defined(_ALLOW_DEBUG_CHEATS_IN_RELEASE)
		ini.loadFileDirectory("Data\\INI\\CommandMapDemo", INI_LOAD_MULTIFILE, nullptr);
#endif

		TheMetaMap->generateMetaMap();
		TheMetaMap->verifyMetaMap();


		initSubsystem(TheActionManager,"TheActionManager", MSGNEW("GameEngineSubsystem") ActionManager(), nullptr);
		//initSubsystem((CComObject<WebBrowser> *)TheWebBrowser,"(CComObject<WebBrowser> *)TheWebBrowser", (CComObject<WebBrowser> *)createWebBrowser(), nullptr);
		initSubsystem(TheGameStateMap,"TheGameStateMap", MSGNEW("GameEngineSubsystem") GameStateMap, nullptr );
		initSubsystem(TheGameState,"TheGameState", MSGNEW("GameEngineSubsystem") GameState, nullptr );

		// Create the interface for sending game results
#if defined(SAGE_USE_GAMESPY)
		initSubsystem(TheGameResultsQueue,"TheGameResultsQueue", GameResultsInterface::createNewGameResultsInterface(), nullptr);
#endif


	#ifdef DUMP_PERF_STATS///////////////////////////////////////////////////////////////////////////
	GetPrecisionTimer(&endTime64);//////////////////////////////////////////////////////////////////
	sprintf(Buf,"----------------------------------------------------------------------------After TheGameResultsQueue = %f seconds",((double)(endTime64-startTime64)/(double)(freq64)));
  startTime64 = endTime64;//Reset the clock ////////////////////////////////////////////////////////
	DEBUG_LOG(("%s", Buf));////////////////////////////////////////////////////////////////////////////
	#endif/////////////////////////////////////////////////////////////////////////////////////////////


		xferCRC.close();
		TheWritableGlobalData->m_iniCRC = xferCRC.getCRC();
		DEBUG_LOG(("INI CRC is 0x%8.8X", TheGlobalData->m_iniCRC));

		TheSubsystemList->postProcessLoadAll();

		// GeneralsX @bugfix Copilot 11/05/2026 Prevent uncapped render when FPS limiter is enabled but no valid limit value was loaded.
		if (TheGlobalData->m_useFpsLimit && TheGlobalData->m_framesPerSecondLimit <= 0)
		{
			TheWritableGlobalData->m_framesPerSecondLimit = BaseFps;
		}

		TheFramePacer->setFramesPerSecondLimit(TheGlobalData->m_framesPerSecondLimit);

		TheAudio->setOn(TheGlobalData->m_audioOn && TheGlobalData->m_musicOn, AudioAffect_Music);
		TheAudio->setOn(TheGlobalData->m_audioOn && TheGlobalData->m_soundsOn, AudioAffect_Sound);
		TheAudio->setOn(TheGlobalData->m_audioOn && TheGlobalData->m_sounds3DOn, AudioAffect_Sound3D);
		TheAudio->setOn(TheGlobalData->m_audioOn && TheGlobalData->m_speechOn, AudioAffect_Speech);

		// We're not in a network game yet, so set the network singleton to nullptr.
		TheNetwork = nullptr;

		//Create a default ini file for options if it doesn't already exist.
		//OptionPreferences prefs( TRUE );

		// If we turn m_quitting to FALSE here, then we throw away any requests to quit that
		// took place during loading. :-\ - jkmcd
		// If this really needs to take place, please make sure that pressing cancel on the audio
		// load music dialog will still cause the game to quit.
		// m_quitting = FALSE;

		// initialize the MapCache
		TheMapCache = MSGNEW("GameEngineSubsystem") MapCache;
		TheMapCache->updateCache();
		startCommandLineBotMatch();


	#ifdef DUMP_PERF_STATS///////////////////////////////////////////////////////////////////////////
	GetPrecisionTimer(&endTime64);//////////////////////////////////////////////////////////////////
	sprintf(Buf,"----------------------------------------------------------------------------After TheMapCache->updateCache = %f seconds",((double)(endTime64-startTime64)/(double)(freq64)));
  startTime64 = endTime64;//Reset the clock ////////////////////////////////////////////////////////
	DEBUG_LOG(("%s", Buf));////////////////////////////////////////////////////////////////////////////
	#endif/////////////////////////////////////////////////////////////////////////////////////////////


		if (TheGlobalData->m_buildMapCache)
		{
			// just quit, since the map cache has already updated
			//populateMapListbox(nullptr, true, true);
			m_quitting = TRUE;
		}

		// load the initial shell screen
		if (TheCommandLineLoadStateFile[0] == '\0' && TheCommandLineBotMatchMap[0] == '\0')
			TheShell->push( "Menus/MainMenu.wnd" );

		// This allows us to run a map from the command line
		if (TheGlobalData->m_initialFile.isEmpty() == FALSE)
		{
			AsciiString fname = TheGlobalData->m_initialFile;
			fname.toLower();

			if (fname.endsWithNoCase(".map"))
			{
				TheWritableGlobalData->m_shellMapOn = FALSE;
				TheWritableGlobalData->m_playIntro = FALSE;
				TheWritableGlobalData->m_pendingFile = TheGlobalData->m_initialFile;

				// shutdown the top, but do not pop it off the stack
	//			TheShell->hideShell();

				// send a message to the logic for a new game
				GameMessage *msg = TheMessageStream->appendMessage( GameMessage::MSG_NEW_GAME );
				msg->appendIntegerArgument(GAME_SINGLE_PLAYER);
				msg->appendIntegerArgument(DIFFICULTY_NORMAL);
				msg->appendIntegerArgument(0);
				InitRandom(0);
			}
		}

		//
		if (TheMapCache && TheGlobalData->m_shellMapOn)
		{
			AsciiString lowerName = TheGlobalData->m_shellMapName;
			lowerName.toLower();

			MapCache::const_iterator it = TheMapCache->find(lowerName);
			if (it == TheMapCache->end())
			{
				TheWritableGlobalData->m_shellMapOn = FALSE;
			}
		}

	}
	catch (ErrorCode ec)
	{
		if (ec == ERROR_INVALID_D3D)
		{
			RELEASE_CRASHLOCALIZED("ERROR:D3DFailurePrompt", "ERROR:D3DFailureMessage");
		}
	}
	catch (INIException e)
	{
		if (e.mFailureMessage)
			RELEASE_CRASH((e.mFailureMessage));
		else
			RELEASE_CRASH(("Uncaught Exception during initialization."));

	}
	catch (...)
	{
		RELEASE_CRASH(("Uncaught Exception during initialization."));
	}

	resetSubsystems();

	HideControlBar();

	if (TheCommandLineLoadStateFile[0] != '\0')
	{
		fprintf(stderr, "[GeneralsX] SAVE_STATE_LOAD_BEGIN file=%s\n", TheCommandLineLoadStateFile);
		AvailableGameInfo gameInfo = {};
		gameInfo.filename = TheCommandLineLoadStateFile;
		TheGameState->getSaveGameInfoFromFile(
			TheGameState->getFilePathInSaveDirectory(gameInfo.filename), &gameInfo.saveGameInfo);
		TheGameLogic->prepareNewGame(GAME_SINGLE_PLAYER, DIFFICULTY_NORMAL, 0);
		if (TheGameState->loadGame(gameInfo) != SC_OK)
		{
			fprintf(stderr, "[GeneralsX] SAVE_STATE_LOAD_FAILED file=%s\n", TheCommandLineLoadStateFile);
			m_quitting = TRUE;
		}
		else
		{
			TheGameClient->setTimeOfDay(TheGlobalData->m_timeOfDay);
			fprintf(stderr, "[GeneralsX] SAVE_STATE_LOADED file=%s frame=%u mode=%d\n",
				TheCommandLineLoadStateFile, TheGameLogic->getFrame(), TheGameLogic->getGameMode());
			if (TheCommandLinePauseFrame != 0)
			{
				TheCommandLinePauseFrame = TheGameLogic->getFrame() + 1;
				TheGameLogic->setGamePaused(FALSE, FALSE, FALSE);
				TheGameLogic->setGamePausedInFrame(TheCommandLinePauseFrame, TRUE);
			}
		}
	}
}

/** -----------------------------------------------------------------------------------------------
	* Reset all necessary parts of the game engine to be ready to accept new game data
	*/
void GameEngine::reset()
{

	WindowLayout *background = TheWindowManager->winCreateLayout("Menus/BlankWindow.wnd");
	DEBUG_ASSERTCRASH(background,("We Couldn't Load Menus/BlankWindow.wnd"));
	if (background == nullptr)
	{
		// GeneralsX @bugfix Codex 04/08/2026 Fail closed when the required reset layout is unavailable in release builds.
		RELEASE_CRASH("Missing required layout: Menus/BlankWindow.wnd");
		return;
	}
	background->hide(FALSE);
	background->bringForward();
	background->getFirstWindow()->winClearStatus(WIN_STATUS_IMAGE);
	Bool deleteNetwork = false;
	if (TheGameLogic->isInMultiplayerGame())
		deleteNetwork = true;

	resetSubsystems();

	if (deleteNetwork)
	{
		DEBUG_ASSERTCRASH(TheNetwork, ("Deleting null TheNetwork!"));
		delete TheNetwork;
		TheNetwork = nullptr;
	}
	if(background)
	{
		background->destroyWindows();
		deleteInstance(background);
		background = nullptr;
	}
}

/// -----------------------------------------------------------------------------------------------
void GameEngine::resetSubsystems()
{
	// TheSuperHackers @fix xezon 09/06/2025 Reset GameLogic first to purge all world objects early.
	// This avoids potentially catastrophic issues when objects and subsystems have cross dependencies.
	TheGameLogic->reset();

	TheSubsystemList->resetAll();
}

/// -----------------------------------------------------------------------------------------------
Bool GameEngine::canUpdateGameLogic(UnsignedInt logicTimeQueryFlags)
{
	// This updates the paused game status of the game logic.
	TheGameLogic->preUpdate();

	TheFramePacer->setTimeFrozen(isTimeFrozen());
	TheFramePacer->setGameHalted(isGameHalted());

	if (TheNetwork != nullptr)
	{
		return canUpdateNetworkGameLogic();
	}
	else
	{
		return canUpdateRegularGameLogic(logicTimeQueryFlags);
	}
}

/// -----------------------------------------------------------------------------------------------
Bool GameEngine::canUpdateNetworkGameLogic()
{
	DEBUG_ASSERTCRASH(TheNetwork != nullptr, ("TheNetwork is null"));

	if (TheNetwork->isFrameDataReady())
	{
		// Important: The Network is definitely no longer stalling.
		TheFramePacer->setGameHalted(false);

		return true;
	}

	return false;
}

/// -----------------------------------------------------------------------------------------------
Bool GameEngine::canUpdateRegularGameLogic(UnsignedInt logicTimeQueryFlags)
{
	const Int logicTimeScaleFps = TheFramePacer->getActualLogicTimeScaleFps(logicTimeQueryFlags);

	if (logicTimeScaleFps <= 0)
	{
		return false;
	}

	const Bool enabled = TheFramePacer->isLogicTimeScaleEnabled();
	const Int maxRenderFps = TheFramePacer->getActualFramesPerSecondLimit();

#if defined(_ALLOW_DEBUG_CHEATS_IN_RELEASE)
	const Bool useFastMode = TheGlobalData->m_TiVOFastMode;
#else	//always allow this cheat key if we're in a replay game.
	const Bool useFastMode = TheGlobalData->m_TiVOFastMode && TheGameLogic->isInReplayGame();
#endif
	const Bool useBotMatchFastMode = TheCommandLineBotMatchMap[0] != '\0' && TheCommandLineBotMatchSpeed > 1;
	const Bool useReplayFastMode = !TheGlobalData->m_simulateReplays.empty() && TheCommandLineReplaySpeed > 1;

	if (useFastMode || useBotMatchFastMode || useReplayFastMode || !enabled || logicTimeScaleFps >= maxRenderFps)
	{
		// Logic time scale is uncapped or larger equal Render FPS. Update straight away.
		return true;
	}
	else
	{
		// TheSuperHackers @tweak xezon 06/08/2025
		// The logic time step is now decoupled from the render update.
		const Real targetFrameTime = 1.0f / logicTimeScaleFps;
		m_logicTimeAccumulator += min(TheFramePacer->getUpdateTime(), targetFrameTime);

		if (m_logicTimeAccumulator >= targetFrameTime)
		{
			m_logicTimeAccumulator -= targetFrameTime;
			return true;
		}
	}

	return false;
}

/// -----------------------------------------------------------------------------------------------
DECLARE_PERF_TIMER(GameEngine_update)

/** -----------------------------------------------------------------------------------------------
 * Update the game engine by updating the GameClient and GameLogic singletons.
 */
void GameEngine::update()
{
	USE_PERF_TIMER(GameEngine_update)
	{
		{
			// VERIFY CRC needs to be in this code block.  Please to not pull TheGameLogic->update() inside this block.
			VERIFY_CRC

			TheRadar->UPDATE();

			/// @todo Move audio init, update, etc, into GameClient update

			TheAudio->UPDATE();
			TheGameClient->UPDATE();
			TheMessageStream->propagateMessages();

			if (TheNetwork != nullptr)
			{
				TheNetwork->UPDATE();
			}
		}

		// TheSuperHackers @info Ignores frozen time because the script engine needs updating in the logic update regardless.
		if (canUpdateGameLogic(FramePacer::IgnoreFrozenTime))
		{
			TheGameLogic->UPDATE();

			if (!TheFramePacer->isTimeFrozen())
			{
				TheGameClient->step();
			}
		}
	}
}

// Horrible reference, but we really, really need to know if we are windowed.
extern bool DX8Wrapper_IsWindowed;
extern HWND ApplicationHWnd;

/** -----------------------------------------------------------------------------------------------
 * The "main loop" of the game engine. It will not return until the game exits.
 */
void GameEngine::execute()
{
	// pretty basic for now
	while( !m_quitting )
		executeFrame();
}

// GeneralsX @port Codex 04/08/2026 Expose one deterministic iteration for browser frame scheduling.
void GameEngine::executeFrame()
{
	const Int64 botMatchFrameStart = TheCommandLineBotMatchMap[0] != '\0' ? getBotMatchCounter() : 0;
#if defined(RTS_DEBUG)
	static const DWORD startTime = timeGetTime() / 1000;
#endif

	//if (TheGlobalData->m_vTune)
	{
#ifdef PERF_TIMERS
		PerfGather::resetAll();
#endif
	}

	{

#if defined(RTS_DEBUG)
		{
			// enter only if in benchmark mode
			if (TheGlobalData->m_benchmarkTimer > 0)
			{
				DWORD currentTime = timeGetTime() / 1000;
				if (TheGlobalData->m_benchmarkTimer < currentTime - startTime)
				{
					if (TheGameLogic->isInGame())
					{
						if (TheRecorder->getMode() == RECORDERMODETYPE_RECORD)
						{
							TheRecorder->stopRecording();
						}
						TheGameLogic->clearGameData();
					}
					TheGameEngine->setQuitting(TRUE);
				}
			}
		}
#endif

		{
			try
			{
				// compute a frame
				update();
			}
			catch (INIException e)
			{
				// Release CRASH doesn't return, so don't worry about executing additional code.
				if (e.mFailureMessage)
					RELEASE_CRASH((e.mFailureMessage));
				else
					RELEASE_CRASH(("Uncaught Exception in GameEngine::update"));
			}
			catch (...)
			{
				// try to save info off
				try
				{
					if (TheRecorder && TheRecorder->getMode() == RECORDERMODETYPE_RECORD && TheRecorder->isMultiplayer())
						TheRecorder->cleanUpReplayFile();
				}
				catch (...)
				{
				}
				RELEASE_CRASH(("Uncaught Exception in GameEngine::update"));
			}
		}

		// TheFramePacer->update() sleeps here to hold the render FPS cap (RenderFpsPreset /
		// GlobalData::m_framesPerSecondLimit). Because input is serviced once per iteration of
		// this loop (SDL poll + GameClient::UPDATE message processing, above), this pacing wait
		// also throttles the input sampling rate. A low FPS cap therefore makes the mouse feel
		// laggy (hard to click moving units) even though the fixed 30 Hz simulation is unchanged.
		// See RenderFpsPreset::s_fpsValues in FrameRateLimit.cpp for the full explanation.
		TheFramePacer->update();

		if (TheCommandLineBotMatchMap[0] != '\0' && TheGameLogic->isInGame() &&
			!TheGameLogic->isLoadingMap() && TheGameLogic->getFrame() > 0 &&
			TheGameClient->isDrawingEnabled())
		{
			const Int64 now = getBotMatchCounter();
			const Int64 frequency = 1000000;
			if (m_botMatchStartCounter == 0)
				m_botMatchStartCounter = botMatchFrameStart;
			const double frameMilliseconds = 1000.0 * static_cast<double>(now - botMatchFrameStart) /
				static_cast<double>(frequency);
			m_botMatchFrameMilliseconds += frameMilliseconds;
			m_botMatchMaxFrameMilliseconds = max(m_botMatchMaxFrameMilliseconds, frameMilliseconds);
			++m_botMatchRenderFrames;
			const UnsignedInt drawCalls = static_cast<UnsignedInt>(max(0, TheDisplay->getLastFrameDrawCalls()));
			m_botMatchDrawCalls += drawCalls;
			m_botMatchMaxDrawCalls = max(m_botMatchMaxDrawCalls, drawCalls);

			const UnsignedInt endFrame = TheVictoryConditions->getEndFrame();
			if (!m_botMatchResultEmitted &&
				(endFrame != 0 || TheGameLogic->getFrame() >= TheCommandLineBotMatchMaxFrames))
			{
				m_botMatchResultEmitted = TRUE;
				if (endFrame != 0 && TheRecorder && TheRecorder->getMode() == RECORDERMODETYPE_RECORD)
					TheRecorder->stopRecording();
				const UnsignedInt crc = TheGameLogic->getCRC(CRC_RECALC);
				const double wallSeconds = static_cast<double>(now - m_botMatchStartCounter) /
					static_cast<double>(frequency);
				const double averageFPS = wallSeconds > 0.0 ? m_botMatchRenderFrames / wallSeconds : 0.0;
				const double averageFrameMilliseconds = m_botMatchRenderFrames > 0 ?
					m_botMatchFrameMilliseconds / m_botMatchRenderFrames : 0.0;
				const double averageDrawCalls = m_botMatchRenderFrames > 0 ?
					static_cast<double>(m_botMatchDrawCalls) / m_botMatchRenderFrames : 0.0;
				Int winnerSlot = -1;
				if (endFrame != 0 && TheSkirmishGameInfo)
				{
					const Bool firstDefeated = TheSkirmishGameInfo->getConstSlot(1)->lastFrameInGame() != 0;
					const Bool secondDefeated = TheSkirmishGameInfo->getConstSlot(2)->lastFrameInGame() != 0;
					if (firstDefeated != secondDefeated)
						winnerSlot = firstDefeated ? 2 : 1;
				}
#if defined(__EMSCRIPTEN__)
				const char *platform = "webgpu";
#elif defined(__APPLE__)
				const char *platform = "macos";
#else
				const char *platform = "linux";
#endif
				fprintf(stderr,
					"GENERALSX_BOT_MATCH_RESULT {\"platform\":\"%s\",\"reason\":\"%s\",\"logicFrame\":%u,\"endFrame\":%u,\"winnerSlot\":%d,\"logicCRC\":\"%08X\",\"renderFrames\":%u,\"wallSeconds\":%.6f,\"averageFPS\":%.3f,\"averageFrameMs\":%.3f,\"maxFrameMs\":%.3f,\"averageDrawCalls\":%.3f,\"maxDrawCalls\":%u}\n",
					platform, endFrame != 0 ? "victory" : "frame-limit", TheGameLogic->getFrame(), endFrame,
					winnerSlot, crc, m_botMatchRenderFrames, wallSeconds, averageFPS, averageFrameMilliseconds,
					m_botMatchMaxFrameMilliseconds, averageDrawCalls, m_botMatchMaxDrawCalls);
				fflush(stderr);
				TheGameLogic->setGamePaused(TRUE, FALSE, FALSE);
			}
		}

		// NOTE: TheDisplay->draw() is called via TheGameClient->UPDATE() above.
		// GameClient::update() dispatches TheDisplay->DRAW() each frame.
		// Do NOT add an extra draw() call here - it would double-present per frame.
	}

#ifdef PERF_TIMERS
	if (!m_quitting && TheGameLogic->isInGame() && !TheGameLogic->isInShellGame() && !TheGameLogic->isGamePaused())
	{
		PerfGather::dumpAll(TheGameLogic->getFrame());
		PerfGather::displayGraph(TheGameLogic->getFrame());
		PerfGather::resetAll();
	}
#endif
}

/** -----------------------------------------------------------------------------------------------
	* Factory for the message stream
	*/
MessageStream *GameEngine::createMessageStream()
{
	// if you change this update the tools that use the engine systems
	// like GUIEdit, it creates a message stream to run in "test" mode
	return MSGNEW("GameEngineSubsystem") MessageStream;
}

//-------------------------------------------------------------------------------------------------
FileSystem *GameEngine::createFileSystem()
{
	return MSGNEW("GameEngineSubsystem") FileSystem;
}

//-------------------------------------------------------------------------------------------------
Bool GameEngine::isMultiplayerSession()
{
	return TheRecorder->isMultiplayer();
}

//-------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------
#define CONVERT_EXEC1	"..\\Build\\nvdxt -list buildDDS.txt -dxt5 -full -outdir Art\\Textures > buildDDS.out"

void updateTGAtoDDS()
{
	// Here's the scoop. We're going to traverse through all of the files in the Art\Textures folder
	// and determine if there are any .tga files that are newer than associated .dds files. If there
	// are, then we will re-run the compression tool on them.

	File *fp = TheLocalFileSystem->openFile("buildDDS.txt", File::WRITE | File::CREATE | File::TRUNCATE | File::TEXT);
	if (!fp) {
		return;
	}

	FilenameList files;
	TheLocalFileSystem->getFileListInDirectory("Art\\Textures\\", "", "*.tga", files, TRUE);
	FilenameList::iterator it;
	for (it = files.begin(); it != files.end(); ++it) {
		AsciiString filenameTGA = *it;
		AsciiString filenameDDS = *it;
		FileInfo infoTGA;
		TheLocalFileSystem->getFileInfo(filenameTGA, &infoTGA);

		// skip the water textures, since they need to be NOT compressed
		filenameTGA.toLower();
		if (strstr(filenameTGA.str(), "caust"))
		{
			continue;
		}
		// and the recolored stuff.
		if (strstr(filenameTGA.str(), "zhca"))
		{
			continue;
		}

		// replace tga with dds
		filenameDDS.truncateBy(3); // tga
		filenameDDS.concat("dds");

		Bool needsToBeUpdated = FALSE;
		FileInfo infoDDS;
		if (TheFileSystem->doesFileExist(filenameDDS.str())) {
			TheFileSystem->getFileInfo(filenameDDS, &infoDDS);
			if (infoTGA.timestampHigh > infoDDS.timestampHigh ||
					(infoTGA.timestampHigh == infoDDS.timestampHigh &&
					 infoTGA.timestampLow > infoDDS.timestampLow)) {
				needsToBeUpdated = TRUE;
			}
		} else {
			needsToBeUpdated = TRUE;
		}

		if (!needsToBeUpdated) {
			continue;
		}

		filenameTGA.concat("\n");
		fp->write(filenameTGA.str(), filenameTGA.getLength());
	}

	fp->close();

// TheSuperHackers @build fighter19 11/02/2026 Windows-only texture conversion
#ifdef _WIN32
	system(CONVERT_EXEC1);
#else
	// Linux: TGA to DDS conversion not needed (or handle differently)
#endif
}

//-------------------------------------------------------------------------------------------------
// System things

// If we're using the Wide character version of MessageBox, then there's no additional
// processing necessary. Please note that this is a sleazy way to get this information,
// but pending a better one, this'll have to do.
// TheSuperHackers @build fighter19 11/02/2026 MessageBox detection (Windows-only)
#ifdef _WIN32
extern const Bool TheSystemIsUnicode = (((void*) (::MessageBox)) == ((void*) (::MessageBoxW)));
#else
extern const Bool TheSystemIsUnicode = true;  // Linux: Always Unicode (UTF-8)
#endif
