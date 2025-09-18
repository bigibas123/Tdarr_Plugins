"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plugin = exports.details = void 0;
var flowUtils_1 = require("../../../../FlowHelpers/1.0.0/interfaces/flowUtils");
/* eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }] */
var details = function () { return ({
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
            tooltip: "Specify language tag/s here for the subtitle tracks you'd like to burn in.\n               \\nExample:\\n\n               eng\n\n               \\nExample:\\n\n               eng,jpn",
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
            tooltip: "If enabled (default), subtitle tracks without a language tag will also be burned in.\n                \\nIf disabled, only subtitle tracks with a language tag matching one of those specified in\n                 the Language Tag(s) to Burn field will be burned in.\n                \\n If no language tags are specified, all subtitle tracks will be burned in anyway.",
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
            tooltip: "The maximum number of subtitle tracks to burn in.\\n\n      If more subtitle tracks are found, only the first X will be burned in, where X is the value specified here.\\n\n      Set to 0 to burn all tracks.",
        },
    ],
    outputs: [
        {
            number: 1,
            tooltip: 'Continue to next plugin',
        },
    ],
}); };
exports.details = details;
// Helper function to extract existing video filter from arguments
var extractVideoFilter = function (args) {
    var fullFilterIndex = args.indexOf('-filter:v');
    if (fullFilterIndex !== -1 && fullFilterIndex + 1 < args.length) {
        return {
            filterValue: args[fullFilterIndex + 1],
            filterIndex: fullFilterIndex,
        };
    }
    var shortFilterIndex = args.indexOf('-vf');
    if (shortFilterIndex !== -1 && shortFilterIndex + 1 < args.length) {
        return {
            filterValue: args[shortFilterIndex + 1],
            filterIndex: shortFilterIndex,
        };
    }
    return null;
};
var mergeVideoFilters = function (existingFilter, newFilters) {
    if (newFilters.length === 0) {
        return existingFilter;
    }
    if (!existingFilter || existingFilter.trim() === '') {
        return newFilters.join(',');
    }
    return "".concat(existingFilter, ",").concat(newFilters.join(','));
};
var updateVideoFilterInArgs = function (args, newFilters) {
    if (newFilters.length === 0)
        return;
    var existingFilter = extractVideoFilter(args);
    if (existingFilter) {
        var mergedFilter = mergeVideoFilters(existingFilter.filterValue, newFilters);
        // eslint-disable-next-line no-param-reassign
        args[existingFilter.filterIndex + 1] = mergedFilter;
    }
    else {
        args.push('-filter:v', newFilters.join(','));
    }
};
var getExistingVideoFilters = function (args) {
    if (!args)
        return { hasFilters: false };
    var existingFilter = extractVideoFilter(args);
    return {
        hasFilters: existingFilter !== null,
        filterValue: existingFilter === null || existingFilter === void 0 ? void 0 : existingFilter.filterValue,
    };
};
var buildSubtitleFilters = function (subtitleStreams, inputFilePath, logger) { return subtitleStreams.map(function (stream, index) {
    var _a, _b, _c, _d;
    var title = (_b = (_a = stream.tags) === null || _a === void 0 ? void 0 : _a.title) !== null && _b !== void 0 ? _b : '';
    var language = (_d = (_c = stream.tags) === null || _c === void 0 ? void 0 : _c.language) !== null && _d !== void 0 ? _d : '';
    logger("Subtitle stream found: 0:".concat(stream.index, "(").concat(index, "): ").concat(stream.codec_name, " ").concat(title, "(").concat(language, ")"));
    logger("Stream details: ".concat(JSON.stringify(stream)));
    return "subtitles=filename='".concat(inputFilePath, "':si=").concat(index);
}); };
// eslint-disable-next-line @typescript-eslint/no-unused-vars
var plugin = function (args) {
    var lib = require('../../../../../methods/lib')();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars,no-param-reassign
    args.inputs = lib.loadDefaultValues(args.inputs, details);
    var tagsToBurn = String(args.inputs.language_tags)
        .split(',')
        .map(function (tag) { return tag.trim().toLowerCase(); }).filter(function (tag) { return tag !== ''; });
    var alsoBurnUntagged = args.inputs.also_burn_untaged === true || args.inputs.also_burn_untaged === 'true';
    var maxSubtitles = parseInt(String(args.inputs.max_subtitles), 10);
    if (Number.isNaN(maxSubtitles) || maxSubtitles < 0) {
        throw new Error('Invalid value for max_subtitles input. Must be a non-negative integer.');
    }
    (0, flowUtils_1.checkFfmpegCommandInit)(args);
    // Find the video stream
    var videoStream = args.variables.ffmpegCommand.streams
        .find(function (stream) { return stream.codec_type.toLowerCase() === 'video'; });
    if (!videoStream) {
        throw new Error('No video stream found in file');
    }
    // Collect subtitle streams
    var subtitleStreams = args.variables.ffmpegCommand.streams
        .filter(function (stream) { return stream.codec_type.toLowerCase() === 'subtitle'; })
        .filter(function (stream) {
        var _a, _b;
        if (tagsToBurn.length === 0) {
            return true; // No tags specified, include all subtitle streams
        }
        var streamTag = ((_b = (_a = stream.tags) === null || _a === void 0 ? void 0 : _a.language) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || '';
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
        args.jobLog("No max subtitles limit set, burning all ".concat(subtitleStreams.length, " subtitle streams"));
    }
    else {
        if (maxSubtitles < subtitleStreams.length) {
            subtitleStreams = subtitleStreams.slice(0, maxSubtitles);
        }
        else {
            subtitleStreams = subtitleStreams.slice(0, subtitleStreams.length);
        }
        args.jobLog("Left over streams (".concat(subtitleStreams.length, "): ").concat(JSON.stringify(subtitleStreams)));
    }
    // Build subtitle video filters
    var videoFilters = buildSubtitleFilters(subtitleStreams, args.inputFileObj._id, args.jobLog);
    // Get all already existing video filters, since ffmpeg doesn't support multiple -filter:v/-vf arguments
    var overallFilters = getExistingVideoFilters(args.variables.ffmpegCommand.overallOuputArguments);
    var streamFilters = getExistingVideoFilters(videoStream.streamArgs);
    if (overallFilters.hasFilters) {
        // Merge with overall output arguments
        args.jobLog("Found existing overall video filter: ".concat(overallFilters.filterValue));
        args.jobLog('Merging subtitle filters with existing overall filters');
        updateVideoFilterInArgs(args.variables.ffmpegCommand.overallOuputArguments, videoFilters);
    }
    else if (streamFilters.hasFilters) {
        // Merge with stream-specific arguments
        args.jobLog("Found existing stream video filter: ".concat(streamFilters.filterValue));
        args.jobLog('Merging subtitle filters with existing stream filters');
        updateVideoFilterInArgs(videoStream.outputArgs, videoFilters);
    }
    else {
        // No existing filters, add new ones to stream
        args.jobLog('No existing video filters found, adding subtitle filters to stream');
        videoStream.outputArgs.push('-filter:v', videoFilters.join(','));
    }
    args.jobLog("Added ".concat(videoFilters.length, " subtitle filters to video stream"));
    return {
        outputFileObj: args.inputFileObj,
        outputNumber: 1,
        variables: args.variables,
    };
};
exports.plugin = plugin;
