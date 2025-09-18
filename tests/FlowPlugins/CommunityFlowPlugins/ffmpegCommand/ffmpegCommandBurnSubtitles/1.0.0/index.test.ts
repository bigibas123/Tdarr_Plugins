import { plugin } from
  '../../../../../../FlowPluginsTs/CommunityFlowPlugins/ffmpegCommand/ffmpegCommandBurnSubtitles/1.0.0/index';
import { IpluginInputArgs } from '../../../../../../FlowPluginsTs/FlowHelpers/1.0.0/interfaces/interfaces';
import { IFileObject } from '../../../../../../FlowPluginsTs/FlowHelpers/1.0.0/interfaces/synced/IFileObject';

const sampleH264 = require('../../../../../sampleData/media/sampleH264_1.json');

describe('ffmpegCommandBurnSubtitles Plugin', () => {
  let baseArgs: IpluginInputArgs;

  beforeEach(() => {
    baseArgs = {
      inputs: {},
      variables: {
        ffmpegCommand: {
          init: true,
          inputFiles: [],
          streams: [],
          container: 'mp4',
          hardwareDecoding: false,
          shouldProcess: false,
          overallInputArguments: [],
          overallOuputArguments: [],
        },
        flowFailed: false,
        user: {},
      },
      inputFileObj: JSON.parse(JSON.stringify(sampleH264)) as IFileObject,
      jobLog: jest.fn(),
    } as Partial<IpluginInputArgs> as IpluginInputArgs;
  });

  describe('Input arguments validation', () => {
    it('should throw when there is no video stream', () => {
      baseArgs.inputs = { max_subtitles: 0 };
      expect(() => plugin(baseArgs)).toThrow('No video stream found in file');
    });
    it('should throw when max_subtitles is an invalid value', () => {
      expect(() => {
        baseArgs.variables.ffmpegCommand.streams = [
          {
            index: 0,
            codec_name: 'h264',
            codec_type: 'video',
            removed: false,
            mapArgs: ['-map', '0:0'],
            inputArgs: [],
            outputArgs: [],
            forceEncoding: false,
          },
        ];
        baseArgs.inputs = { max_subtitles: -1 };
        plugin(baseArgs);
      }).toThrow('Invalid value for max_subtitles input. Must be a non-negative integer.');
    });
  });

  describe('FFmpeg Command Validation', () => {
    it('should throw error when ffmpegCommand is not initialized', () => {
      baseArgs.variables.ffmpegCommand.init = false;

      expect(() => plugin(baseArgs)).toThrow(
        'FFmpeg command plugins not used correctly. '
        + 'Please use the "Begin Command" plugin before using this plugin. '
        + 'Afterwards, use the "Execute" plugin to execute the built FFmpeg command. '
        + 'Once the "Execute" plugin has been used, you need to use a new "Begin Command" '
        + 'plugin to start a new FFmpeg command.',
      );
    });

    it('should throw error when ffmpegCommand is undefined', () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore: Testing runtime behavior
      delete baseArgs.variables.ffmpegCommand;

      expect(() => plugin(baseArgs)).toThrow(
        'FFmpeg command plugins not used correctly. '
        + 'Please use the "Begin Command" plugin before using this plugin. '
        + 'Afterwards, use the "Execute" plugin to execute the built FFmpeg command. '
        + 'Once the "Execute" plugin has been used, you need to use a new "Begin Command" '
        + 'plugin to start a new FFmpeg command.',
      );
    });

    it('should throw error when variables is undefined', () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore: Testing runtime behavior
      delete baseArgs.variables;

      expect(() => plugin(baseArgs)).toThrow(
        'FFmpeg command plugins not used correctly. '
        + 'Please use the "Begin Command" plugin before using this plugin. '
        + 'Afterwards, use the "Execute" plugin to execute the built FFmpeg command. '
        + 'Once the "Execute" plugin has been used, you need to use a new "Begin Command" '
        + 'plugin to start a new FFmpeg command.',
      );
    });
  });

  describe('Plugin Flow Integration', () => {
    it('should (mostly) preserve existing ffmpegCommand state and configuration', () => {
      baseArgs.variables.ffmpegCommand.shouldProcess = true;
      baseArgs.variables.ffmpegCommand.streams = [
        {
          index: 0,
          codec_name: 'h264',
          codec_type: 'video',
          removed: false,
          mapArgs: ['-map', '0:0'],
          inputArgs: [],
          outputArgs: [],
          forceEncoding: false,
        },
      ];
      baseArgs.variables.ffmpegCommand.overallInputArguments = ['-t', '60'];
      baseArgs.variables.ffmpegCommand.overallOuputArguments = ['-movflags', '+faststart'];

      const result = plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(result.variables.ffmpegCommand.shouldProcess).toBe(true);
      expect(result.variables.ffmpegCommand.streams).toHaveLength(1);
      expect(result.variables.ffmpegCommand.streams[0].codec_name).toBe('h264');
      expect(result.variables.ffmpegCommand.overallInputArguments).toEqual(['-t', '60']);
      expect(result.variables.ffmpegCommand.overallOuputArguments).toEqual(['-movflags', '+faststart']);
    });
  });
});
