import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const demos = new Map([
  ['mwc26', ['Mwc26AiRanDemo', 'mwc26-ai-ran-beamforming']],
  ['mwc25', ['Mwc25DrlDemo', 'mwc25-drl-beamforming']],
  ['cfp', ['CfpPipelineDemo', 'cfp-radar-system']],
  ['news', ['AiNewsDigestDemo', 'ai-news-digest-system']],
  ['mudplot', ['MudplotDemo', 'mudplot']],
  ['rusty-note', ['RustyNoteDemo', 'rusty-note']],
  ['fido2', ['LicheeRvFido2Demo', 'licheerv-nano-fido2']],
  ['hwp', ['HwpEditorDemo', 'hwp-editor-public']],
  ['niri', ['NiriDesktopSuiteDemo', 'niri-desktop-suite']],
]);

const [project = 'all', appearance = 'both'] = process.argv.slice(2);
if ((project !== 'all' && !demos.has(project)) || !['both', 'light', 'dark'].includes(appearance)) {
  throw new Error('Usage: node render.mjs <all|project> [both|light|dark]');
}

const cli = fileURLToPath(new URL('remotion-cli.js', import.meta.resolve('@remotion/cli/package.json')));
for (const [key, [composition, slug]] of demos) {
  if (project !== 'all' && project !== key) continue;
  for (const theme of appearance === 'both' ? ['light', 'dark'] : [appearance]) {
    const stem = `../static/media/${slug}${theme === 'dark' ? '-dark' : ''}`;
    const render = (command, output, ...flags) => execFileSync(process.execPath, [
      cli, command, 'src/index.ts', composition, output, '--scale=1.5', `--props=${JSON.stringify({ theme })}`, ...flags,
    ], { cwd: import.meta.dirname, stdio: 'inherit' });

    render('still', `${stem}-poster.png`, '--frame=90');
    render('render', `${stem}.mp4`, '--codec=h264', '--crf=21', '--pixel-format=yuv420p');
  }
}
