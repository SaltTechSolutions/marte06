#!/usr/bin/env node
'use strict';

// Runs a command with JAVA_HOME pointed at a JDK new enough for the Firebase
// emulator (21+), whatever the machine's ambient Java happens to be.
//
// This exists because of a specific trap: `/usr/libexec/java_home -v 21` does
// NOT fail when no JDK 21 is installed — it returns the closest match. On this
// machine that was a JRE 17, so the emulator got a Java it cannot run and
// firebase-tools reported only "An unexpected error has occurred", with no
// mention of Java at all. Hours are cheap to lose that way.
//
// Homebrew's openjdk@21 is the managed install; the ambient JAVA_HOME is used
// only if it is already new enough.
//
// Usage: node scripts/with-jdk.cjs <command> [args...]

const { execFileSync, spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');

/** Major version of the JDK at `home`, or 0 if it isn't usable. */
function majorOf(home) {
  if (!home || !existsSync(`${home}/bin/java`)) return 0;
  // `java -version` writes to STDERR, not stdout — reading only stdout gives
  // an empty string and every JDK looks unusable.
  const res = spawnSync(`${home}/bin/java`, ['-version'], { encoding: 'utf8' });
  const m = /version "(\d+)/.exec(`${res.stdout ?? ''}${res.stderr ?? ''}`);
  return m ? Number(m[1]) : 0;
}

function brewPrefix(formula) {
  try {
    return execFileSync('brew', ['--prefix', formula], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const MIN = 21;
const candidates = [brewPrefix('openjdk@21'), process.env.JAVA_HOME].filter(Boolean);
const home = candidates.find((c) => majorOf(c) >= MIN);

if (!home) {
  console.error(
    `Firebase emülatörü için JDK ${MIN}+ gerekiyor, bulunamadı.\n` +
      `  brew install openjdk@21\n` +
      `Kurulu JDK'lar: /usr/libexec/java_home -V`,
  );
  process.exit(1);
}

const [cmd, ...args] = process.argv.slice(2);
const res = spawnSync(cmd, args, {
  stdio: 'inherit',
  env: { ...process.env, JAVA_HOME: home, PATH: `${home}/bin:${process.env.PATH}` },
});
process.exit(res.status ?? 1);
