import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Use the pre-installed Chromium (remote env cannot download Chrome for Testing).
Config.setBrowserExecutable("/opt/pw-browsers/chromium");
Config.setConcurrency(3);
