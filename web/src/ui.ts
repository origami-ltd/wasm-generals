/** Page chrome: HUD header, framed canvas stage, and the first-run ownership gate.
    Every colour comes from the shared brand tokens (data-brand="generals"), so the same markup
    re-themes for the other ports — see packages/ui. */

export const STEAM_HELP = `
  <p>If Steam is installed in the default location on drive C:</p>
  <p><strong>Command &amp; Conquer: Generals</strong><br>
     <code class="text-signal break-all">C:\\Program Files (x86)\\Steam\\steamapps\\common\\Command and Conquer Generals\\</code></p>
  <p><strong>Generals: Zero Hour</strong><br>
     <code class="text-signal break-all">C:\\Program Files (x86)\\Steam\\steamapps\\common\\Command &amp; Conquer Generals - Zero Hour\\</code></p>
  <p>The main executable is <code class="text-signal">Generals.exe</code>. To open the folder directly:
     Steam → Library → right-click the game → Manage → Browse local files.</p>
  <p>On macOS or Linux, pick the folder holding the game's <code class="text-signal">.big</code> archives
     (<code class="text-signal">INIZH.big</code>, <code class="text-signal">TexturesZH.big</code>,
     <code class="text-signal">AudioZH.big</code>…). Select the <strong>Zero Hour</strong> folder first;
     you will then be asked for the base <strong>Generals</strong> folder.</p>`;
