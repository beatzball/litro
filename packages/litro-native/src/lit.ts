/**
 * A controller that reads the platform once, then tells its host.
 *
 * A component cannot read a native capability while it renders: the answer
 * arrives from a promise, and on the server there is no answer at all. So this
 * controller reads the platform when the host connects, holds the result, and
 * asks for exactly one re-render when it lands. Until then `platform` is null
 * and `supports()` is false, which is the honest answer during a server render
 * and on the first client frame.
 *
 * This file does not import Lit. The host type below is declared structurally,
 * so a `LitElement` satisfies it without this package depending on Lit, on a
 * Lit major version, or on Lit at all. Any component base class with the same
 * two members works the same way.
 */

import { platform as readPlatform } from './platform.js';
import type { Capability, PlatformInfo } from './types.js';

/** The controller lifecycle a host calls. Matches Lit's `ReactiveController`. */
export interface NativeControllerLifecycle {
  hostConnected?(): void;
  hostDisconnected?(): void;
}

/**
 * The part of a host this controller uses.
 *
 * Lit's `ReactiveControllerHost` has both members, so a `LitElement` is a valid
 * host with no cast.
 */
export interface NativeControllerHost {
  addController(controller: NativeControllerLifecycle): void;
  requestUpdate(): void;
}

export class NativeController implements NativeControllerLifecycle {
  #host: NativeControllerHost;
  #platform: PlatformInfo | null = null;
  #reading = false;
  #connected = false;

  constructor(host: NativeControllerHost) {
    this.#host = host;
    host.addController(this);
  }

  /**
   * What the platform reported, or null until the answer arrives.
   *
   * Null during a server render and on the first client frame. Render a
   * native-only control only once this is set.
   */
  get platform(): PlatformInfo | null {
    return this.#platform;
  }

  /**
   * Whether a capability does something real here.
   *
   * False until the answer arrives, so a control that depends on a native
   * capability stays hidden rather than flashing and disappearing.
   */
  supports(capability: Capability): boolean {
    return this.#platform?.supports.includes(capability) ?? false;
  }

  hostConnected(): void {
    this.#connected = true;
    if (this.#platform !== null || this.#reading) return;

    this.#reading = true;
    void readPlatform().then(
      (info) => {
        this.#reading = false;
        this.#platform = info;
        // One update, and only while connected. A host that has gone away does
        // not need to re-render, and asking it to is a leak in a long list.
        if (this.#connected) this.#host.requestUpdate();
      },
      () => {
        // Leave the platform unread so a later connect tries again. Caching a
        // failure here would hide every native capability for the life of the
        // page.
        this.#reading = false;
      },
    );
  }

  hostDisconnected(): void {
    this.#connected = false;
  }
}
