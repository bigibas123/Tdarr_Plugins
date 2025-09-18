import { checkFfmpegCommandInit } from '../../../../FlowHelpers/1.0.0/interfaces/flowUtils';
import {
  IffmpegCommandStream,
  IpluginDetails,
  IpluginInputArgs,
  IpluginOutputArgs,
} from '../../../../FlowHelpers/1.0.0/interfaces/interfaces';

/* eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }] */
const details = (): IpluginDetails => ({
  name: 'Burn in subtitles',
  description: 'Burn all existing subtitle tracks into a video file',
  style: {
    borderColor: '#6efefc',
  },
  tags: 'video',
  isStartPlugin: false,
  pType: '',
  requiresVersion: '2.11.01',
  sidebarPosition: -1,
  icon: 'faClosedCaptioning',
  inputs: [
    {
      name: 'language_tags',
      label: 'Language Tag(s) to Burn (Optional)',
      type: 'string',
      defaultValue: '',
      inputUI: {
        type: 'text',
      },
      tooltip: `Specify language tag/s here for the subtitle tracks you'd like to burn in.
               \\nExample:\\n
               eng

               \\nExample:\\n
               eng,jpn`,
    },
    {
      name: 'also_burn_untaged',
      label: 'Also Burn Un-taged Subtitles',
      type: 'boolean',
      defaultValue: 'true',
      inputUI: {
        type: 'switch',
        displayConditions: {
          logic: 'AND',
          sets: [
            {
              logic: 'AND',
              inputs: [
                {
                  name: 'language_tags',
                  value: '',
                  condition: '!==',
                },
              ],
            },
          ],
        },
      },
      tooltip: `If enabled (default), subtitle tracks without a language tag will also be burned in.
                \\nIf disabled, only subtitle tracks with a language tag matching one of those specified in
                 the Language Tag(s) to Burn field will be burned in.
                \\n If no language tags are specified, all subtitle tracks will be burned in anyway.`,
    },
    {
      name: 'max_subtitles',
      label: 'Max Amount of Subtitles to Burn',
      type: 'number',
      defaultValue: '2',
      inputUI: {
        type: 'slider',
        sliderOptions: { min: 0, max: 20 },
      },
      tooltip: `The maximum number of subtitle tracks to burn in.\\n
      If more subtitle tracks are found, only the first X will be burned in, where X is the value specified here.\\n
      Set to 0 to burn all tracks.`,
    },
  ],
  outputs: [
    {
      number: 1,
      tooltip: 'Continue to next plugin',
    },
  ],
});
// Helper function to extract existing video filter from arguments
const extractVideoFilter = (args: string[]): { filterValue: string; filterIndex: number } | null => {
  const fullFilterIndex = args.indexOf('-filter:v');
  if (fullFilterIndex !== -1 && fullFilterIndex + 1 < args.length) {
    return {
      filterValue: args[fullFilterIndex + 1],
      filterIndex: fullFilterIndex,
    };
  }

  const shortFilterIndex = args.indexOf('-vf');
  if (shortFilterIndex !== -1 && shortFilterIndex + 1 < args.length) {
    return {
      filterValue: args[shortFilterIndex + 1],
      filterIndex: shortFilterIndex,
    };
  }

  return null;
};

const mergeVideoFilters = (existingFilter: string, newFilters: string[]): string => {
  if (newFilters.length === 0) {
    return existingFilter;
  }
  if (!existingFilter || existingFilter.trim() === '') {
    return newFilters.join(',');
  }
  return `${existingFilter},${newFilters.join(',')}`;
};

const updateVideoFilterInArgs = (args: string[], newFilters: string[]): void => {
  if (newFilters.length === 0) return;
  const existingFilter = extractVideoFilter(args);
  if (existingFilter) {
    const mergedFilter = mergeVideoFilters(existingFilter.filterValue, newFilters);
    // eslint-disable-next-line no-param-reassign
    args[existingFilter.filterIndex + 1] = mergedFilter;
  } else {
    args.push('-filter:v', newFilters.join(','));
  }
};

const getExistingVideoFilters = (args: string[] | undefined): { hasFilters: boolean; filterValue?: string } => {
  if (!args) return { hasFilters: false };

  const existingFilter = extractVideoFilter(args);

  return {
    hasFilters: existingFilter !== null,
    filterValue: existingFilter?.filterValue,
  };
};

const buildSubtitleFilters = (
  subtitleStreams: IffmpegCommandStream[],
  inputFilePath: string,
  logger: (message: string) => void,
): string[] => subtitleStreams.map((stream, index) => {
  const title = stream.tags?.title ?? '';
  const language = stream.tags?.language ?? '';

  logger(`Subtitle stream found: 0:${stream.index}(${index}): ${stream.codec_name} ${title}(${language})`);
  logger(`Stream details: ${JSON.stringify(stream)}`);

  return `subtitles=filename='${inputFilePath}':si=${index}`;
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const plugin = (args: IpluginInputArgs): IpluginOutputArgs => {
  const lib = require('../../../../../methods/lib')();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars,no-param-reassign
  args.inputs = lib.loadDefaultValues(args.inputs, details);
  const tagsToBurn = String(args.inputs.language_tags)
    .split(',')
    .map((tag) => tag.trim().toLowerCase()).filter((tag) => tag !== '');
  const alsoBurnUntagged = args.inputs.also_burn_untaged === true || args.inputs.also_burn_untaged === 'true';
  const maxSubtitles = parseInt(String(args.inputs.max_subtitles), 10);

  if (Number.isNaN(maxSubtitles) || maxSubtitles < 0) {
    throw new Error('Invalid value for max_subtitles input. Must be a non-negative integer.');
  }

  checkFfmpegCommandInit(args);

  // Find the video stream
  const videoStream = args.variables.ffmpegCommand.streams
    .find((stream) => stream.codec_type.toLowerCase() === 'video');
  if (!videoStream) {
    throw new Error('No video stream found in file');
  }

  // Collect subtitle streams
  let subtitleStreams = args.variables.ffmpegCommand.streams
    .filter((stream) => stream.codec_type.toLowerCase() === 'subtitle')
    .filter((stream) => {
      if (tagsToBurn.length === 0) {
        return true; // No tags specified, include all subtitle streams
      }
      const streamTag = stream.tags?.language?.toLowerCase() || '';
      if (streamTag === '' && alsoBurnUntagged) {
        return true; // Untagged stream and we want to include untagged
      }
      return tagsToBurn.includes(streamTag); // Include if tag matches
    });

  if (subtitleStreams.length === 0) {
    args.jobLog('No subtitle streams found, skipping subtitle burn-in');
    return {
      outputFileObj: args.inputFileObj,
      outputNumber: 1,
      variables: args.variables,
    };
  }
  // Limit stream count
  if (maxSubtitles === 0) {
    args.jobLog(`No max subtitles limit set, burning all ${subtitleStreams.length} subtitle streams`);
  } else {
    if (maxSubtitles < subtitleStreams.length) {
      subtitleStreams = subtitleStreams.slice(0, maxSubtitles);
    } else {
      subtitleStreams = subtitleStreams.slice(0, subtitleStreams.length);
    }
    args.jobLog(`Left over streams (${subtitleStreams.length}): ${JSON.stringify(subtitleStreams)}`);
  }

  // Build subtitle video filters
  const videoFilters = buildSubtitleFilters(
    subtitleStreams,
    args.inputFileObj._id,
    args.jobLog,
  );

  // Get all already existing video filters, since ffmpeg doesn't support multiple -filter:v/-vf arguments
  const overallFilters = getExistingVideoFilters(args.variables.ffmpegCommand.overallOuputArguments);
  const streamFilters = getExistingVideoFilters(videoStream.streamArgs);

  if (overallFilters.hasFilters) {
    // Merge with overall output arguments
    args.jobLog(`Found existing overall video filter: ${overallFilters.filterValue}`);
    args.jobLog('Merging subtitle filters with existing overall filters');
    updateVideoFilterInArgs(args.variables.ffmpegCommand.overallOuputArguments, videoFilters);
  } else if (streamFilters.hasFilters) {
    // Merge with stream-specific arguments
    args.jobLog(`Found existing stream video filter: ${streamFilters.filterValue}`);
    args.jobLog('Merging subtitle filters with existing stream filters');
    updateVideoFilterInArgs(videoStream.outputArgs, videoFilters);
  } else {
    // No existing filters, add new ones to stream
    args.jobLog('No existing video filters found, adding subtitle filters to stream');
    videoStream.outputArgs.push('-filter:v', videoFilters.join(','));
  }

  args.jobLog(`Added ${videoFilters.length} subtitle filters to video stream`);

  return {
    outputFileObj: args.inputFileObj,
    outputNumber: 1,
    variables: args.variables,
  };
};

export {
  details,
  plugin,
};
