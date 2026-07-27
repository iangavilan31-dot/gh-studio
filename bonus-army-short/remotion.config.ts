import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Use the pre-installed Chromium (remote env cannot download Chrome for Testing).
Config.setBrowserExecutable(
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"
);
// Concurrency 1 + a generous delayRender timeout: at higher concurrency the
// per-tab font (and audio) init contends and the font FontFace load gets starved
// past the default 28s, failing the render. One tab loads fonts once, reliably.
Config.setConcurrency(1);
Config.setDelayRenderTimeoutInMilliseconds(120000);
