"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBrowserLibrary } from "./library-provider";
import { NativeCartridge } from "./native-cartridge";
import { Icon } from "./icon";

export function CreatePreview() {
  const library = useBrowserLibrary();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <div className="dn-page-heading dn-studio-heading">
        <div>
          <h1>Create</h1>
          <p>Start with a playable build.</p>
        </div>
        <span className="dn-studio-status">
          <Icon name="clock" size={16} /> Studio coming soon
        </span>
      </div>
      <section className="dn-creator-hero">
        <div>
          <Icon name="create" size={30} />
          <h2>
            Make it
            <br />
            yours.
          </h2>
          <p>
            Bring a build. Test a mod. Give your next game idea a place to play.
          </p>
          <span>GB · GBC · NES · GBA · SNES</span>
        </div>
        <div
          className="dn-creator-object"
          aria-label="An unlabelled cartridge for your next game"
        >
          <NativeCartridge title="Your next game" />
          <span className="dn-creator-question" aria-hidden="true">
            ?
          </span>
          <i />
          <i />
          <i />
        </div>
      </section>
      <section className="dn-studio-roadmap" aria-labelledby="modding-heading">
        <header>
          <div>
            <Icon name="create" size={25} />
            <h2 id="modding-heading">AI modding</h2>
          </div>
          <span className="dn-studio-status">Coming soon</span>
        </header>
        <h3>Your idea. A world to remix.</h3>
        <p>
          A preview of the planned studio. Generation, community sessions,
          contributions and publishing are not available yet.
        </p>
        <div
          className="dn-studio-ideas"
          aria-label="Planned customization ideas"
        >
          <div>
            <span className="dn-idea-world" aria-hidden="true">
              ✦
            </span>
            <strong>New worlds</strong>
            <p>Change a setting, build a map, tell another story.</p>
          </div>
          <div>
            <span className="dn-idea-players" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <strong>Play together</strong>
            <p>Imagine multiplayer, shared quests and new ways to play.</p>
          </div>
          <div>
            <span className="dn-idea-rules" aria-hidden="true">
              A <small>+</small> B
            </span>
            <strong>Your rules</strong>
            <p>Remix movement, mechanics and the challenge.</p>
          </div>
        </div>
        <button className="dn-button dn-secondary" disabled>
          <Icon name="clock" size={17} /> Studio coming soon
        </button>
      </section>
      <div className="dn-create-paths">
        <section className="dn-panel">
          <Icon name="play" size={24} />
          <h2>Have a build already?</h2>
          <p>
            Import your own compatible game and test it in this browser. Local
            testing is ready today.
          </p>
          <button
            className="dn-button"
            disabled={importing}
            onClick={() => input.current?.click()}
          >
            {importing ? "Checking file…" : "Import a game build"}
          </button>
          <input
            ref={input}
            className="dn-hidden-input"
            type="file"
            accept=".gb,.gbc,.gba,.nes,.sfc,.smc"
            aria-label="Import your game build"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              setImporting(true);
              setError("");
              try {
                const game = await library.importFile(file);
                router.push(`/play/${game.slug}`);
              } catch (reason) {
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "Could not import this build.",
                );
              } finally {
                setImporting(false);
              }
            }}
          />
          {error && (
            <p className="dn-error" role="alert">
              {error}
            </p>
          )}
        </section>
        <section className="dn-panel">
          <Icon name="guide" size={24} />
          <h2>Find your starting point.</h2>
          <p>
            Bring a compatible patch and a base game you can use. Read about
            packs, local play and the planned creator lifecycle.
          </p>
          <Link className="dn-button dn-secondary" href="/guide">
            Read the field guide <Icon name="arrow" size={17} />
          </Link>
        </section>
      </div>
    </>
  );
}
