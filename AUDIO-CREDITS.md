# Audio credits

The sound effects are from [Various Sound Effects](https://opengameart.org/content/various-sound-effects-0), uploaded by Spring Spring on October 6, 2024. The source page identifies the producer as **Julie Damsgaard / Spring Spring / Spring Enterprises**, [author website](https://spring-enterprises.neocities.org).

**License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).** The OpenGameArt page's CC0 license and producer notice were checked on November 15, 2026. Credit is retained for provenance even though CC0 does not require attribution.

| Game cue | Downloaded source | Runtime file |
| --- | --- | --- |
| Hit impact | [snd_splathit.wav](https://opengameart.org/sites/default/files/snd_splathit.wav) | [Mono hit](assets/sfx/mono/snd_splathit.wav) |
| Player hurt | [player_hit.wav](https://opengameart.org/sites/default/files/player_hit.wav) | [Mono hurt](assets/sfx/mono/player_hit.wav) |
| Enemy killed | [snd_enemyscream.wav](https://opengameart.org/sites/default/files/snd_enemyscream.wav) | [Mono kill](assets/sfx/mono/snd_enemyscream.wav) |
| Player death (`die` or `death`) | [death_2.wav](https://opengameart.org/sites/default/files/death_2.wav), displayed as death.wav on the source page | [Mono death](assets/sfx/mono/death_2.wav) |
| Loot collected | [snd_treasure.wav](https://opengameart.org/sites/default/files/snd_treasure.wav) | [Mono loot](assets/sfx/mono/snd_treasure.wav) |
| Teleport | [snd_warp_in.wav](https://opengameart.org/sites/default/files/snd_warp_in.wav) | [Mono warp in](assets/sfx/mono/snd_warp_in.wav) |
| Development-only alternate, not loaded or distributed | [snd_warp_out.wav](https://opengameart.org/sites/default/files/snd_warp_out.wav) | Not included in the runtime asset set |

Original downloads are retained in the development workspace alongside the mono directory; the runtime distribution needs only the six mapped mono files above. Runtime derivatives are 16-bit PCM, mono, 22,050 Hz; the originals are stereo 16-bit PCM at 44,100 or 96,000 Hz. Derivatives preserve source durations (about 0.111–3.913 seconds). They were converted with FFmpeg using `-ac 1 -ar 22050 -c:a pcm_s16le`; no loudness normalization or target was applied.

At playback, sampled effects use gain 0.7 (death 0.9), with modest 0.97–1.03 playback-rate variation except death. All cues pass through the same master bus with `slider² × 0.18` gain, including synthesized fallbacks. Skill and level cues are generated locally with Web Audio oscillators; other cues also fall back to oscillators when loading is pending, missing, or undecodable. These synthesized sounds contain no third-party recording.

The shared voice budget is eight. Death stops other voices to guarantee priority. `setPaused(true, {allowDeathTail: true})` permits only an already-playing death cue to finish; it never permits a new cue while paused. Ordinary pause, backgrounding, mute, zero volume, and disposal cancel active cues. The caller must enable the exception only while the character is dead and the page is visible.

[Browser regression test](tests/audio_browser.py) verifies all six runtime WAVs decode, contain nonzero PCM, use buffer-source playback, and produce nonzero Web Audio output. It also checks the death tail, cleanup, shared voice bound, failed-download/decode fallback, volume and mute controls, and zero missing production audio requests. These automated signal checks are not a subjective listening test or a measured integrated-loudness certification.
