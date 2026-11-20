import { Config } from '@remotion/cli/config';

// JPEG frames capture much faster than PNG. For lossless frames use: --sequence --image-format=png
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
