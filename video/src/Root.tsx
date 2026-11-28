import React from 'react';
import { Composition } from 'remotion';
import { AiNewsDigestDemo, NEWS_DURATION } from './AiNewsDigestDemo';
import { CFP_DURATION, CfpPipelineDemo } from './CfpPipelineDemo';
import { HWP_EDITOR_DURATION, HwpEditorDemo } from './HwpEditorDemo';
import { LICHEERV_FIDO2_DURATION, LicheeRvFido2Demo } from './LicheeRvFido2Demo';
import { MUDPLOT_DURATION, MudplotDemo } from './MudplotDemo';
import { MWC25_DURATION, Mwc25DrlDemo } from './Mwc25Demo';
import { MWC26_DURATION, Mwc26AiRanDemo } from './Mwc26Demo';
import { NIRI_SUITE_DURATION, NiriDesktopSuiteDemo } from './NiriDesktopSuiteDemo';
import { RUSTY_NOTE_DURATION, RustyNoteDemo } from './RustyNoteDemo';

const demos = [
  ['Mwc26AiRanDemo', Mwc26AiRanDemo, MWC26_DURATION],
  ['Mwc25DrlDemo', Mwc25DrlDemo, MWC25_DURATION],
  ['CfpPipelineDemo', CfpPipelineDemo, CFP_DURATION],
  ['AiNewsDigestDemo', AiNewsDigestDemo, NEWS_DURATION],
  ['MudplotDemo', MudplotDemo, MUDPLOT_DURATION],
  ['RustyNoteDemo', RustyNoteDemo, RUSTY_NOTE_DURATION],
  ['LicheeRvFido2Demo', LicheeRvFido2Demo, LICHEERV_FIDO2_DURATION],
  ['HwpEditorDemo', HwpEditorDemo, HWP_EDITOR_DURATION],
  ['NiriDesktopSuiteDemo', NiriDesktopSuiteDemo, NIRI_SUITE_DURATION],
] as const;

const framings = [
  { suffix: '', width: 1280, height: 720 },
  { suffix: '-Compact', width: 640, height: 640 },
] as const;

export const RemotionRoot: React.FC = () => (
  <>
    {demos.map(([name, component, durationInFrames]) =>
      framings.map(({ suffix, width, height }) => (
        <Composition key={name + suffix} id={name + suffix} component={component}
          durationInFrames={durationInFrames} fps={30} width={width} height={height} />
      )))}
  </>
);
