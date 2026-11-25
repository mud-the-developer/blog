import React from 'react';
import { Composition } from 'remotion';
import { AiNewsDigestDemo, NEWS_DURATION } from './AiNewsDigestDemo';
import { CFP_DURATION, CfpPipelineDemo } from './CfpPipelineDemo';
import { MWC25_DURATION, Mwc25DrlDemo } from './Mwc25Demo';
import { MWC26_DURATION, Mwc26AiRanDemo } from './Mwc26Demo';

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
    </>
  );
};
