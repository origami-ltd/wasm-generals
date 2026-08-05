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

// CommandLine.h
// The command-line interface
// Author: Matthew D. Campbell, September 2001

#pragma once

extern unsigned int TheCommandLinePauseFrame;
extern unsigned int TheCommandLineCaptureFrameDelay;
extern unsigned int TheCommandLineCaptureFrameCount;
extern unsigned int TheCommandLineSaveStateFrame;
extern char TheCommandLineLoadStateFile[256];
extern const char TheCommandLineSaveStateFile[];
extern float TheCommandLineMaxCameraHeight;
extern float TheCommandLineMinCameraHeight;
extern char TheCommandLineBotMatchMap[256];
extern char TheCommandLineBotMatchFaction[64];
extern unsigned int TheCommandLineBotMatchSeed;
extern unsigned int TheCommandLineBotMatchMaxFrames;
extern unsigned int TheCommandLineBotMatchSpeed;
extern unsigned int TheCommandLineReplaySpeed;
extern unsigned int TheCommandLineReplayCheckpointInterval;

class CommandLine
{
public:

	static void parseCommandLineForStartup();
	static void parseCommandLineForEngineInit();
};
