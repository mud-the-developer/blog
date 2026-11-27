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

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Mwc26AiRanDemo"
        component={Mwc26AiRanDemo}
        durationInFrames={MWC26_DURATION}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="Mwc25DrlDemo"
        component={Mwc25DrlDemo}
        durationInFrames={MWC25_DURATION}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="CfpPipelineDemo"
        component={CfpPipelineDemo}
        durationInFrames={CFP_DURATION}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="AiNewsDigestDemo"
        component={AiNewsDigestDemo}
        durationInFrames={NEWS_DURATION}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="MudplotDemo"
        component={MudplotDemo}
        durationInFrames={MUDPLOT_DURATION}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="RustyNoteDemo"
        component={RustyNoteDemo}
        durationInFrames={RUSTY_NOTE_DURATION}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="LicheeRvFido2Demo"
        component={LicheeRvFido2Demo}
        durationInFrames={LICHEERV_FIDO2_DURATION}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="HwpEditorDemo"
        component={HwpEditorDemo}
        durationInFrames={HWP_EDITOR_DURATION}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="NiriDesktopSuiteDemo"
        component={NiriDesktopSuiteDemo}
        durationInFrames={NIRI_SUITE_DURATION}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
