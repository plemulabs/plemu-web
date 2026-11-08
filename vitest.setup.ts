if (typeof Buffer !== "undefined" && typeof Uint8Array !== "undefined") {
  Object.setPrototypeOf(Buffer.prototype, Uint8Array.prototype);
}

// JSDOM files represent separate browser sessions. Node's native channel crosses
// worker boundaries and was delivering another test file's privacy revocation.
// Keep real browser cross-tab behavior in browser QA; model one origin here.
if (typeof window !== "undefined") {
  class IsolatedBroadcastChannel {
    static channels = new Map<string, Set<IsolatedBroadcastChannel>>();
    onmessage: ((event: MessageEvent) => void) | null = null;
    constructor(public name: string) {
      const group = IsolatedBroadcastChannel.channels.get(name) || new Set();
      group.add(this);
      IsolatedBroadcastChannel.channels.set(name, group);
    }
    postMessage(data: unknown) {
      for (const receiver of IsolatedBroadcastChannel.channels.get(this.name) ||
        []) {
        if (receiver !== this)
          queueMicrotask(() =>
            receiver.onmessage?.(new MessageEvent("message", { data })),
          );
      }
    }
    close() {
      IsolatedBroadcastChannel.channels.get(this.name)?.delete(this);
    }
  }
  Object.defineProperty(window, "BroadcastChannel", {
    configurable: true,
    value: IsolatedBroadcastChannel,
  });
}

if (
  typeof HTMLDialogElement !== "undefined" &&
  !HTMLDialogElement.prototype.showModal
) {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
}
if (
  typeof HTMLDialogElement !== "undefined" &&
  !HTMLDialogElement.prototype.close
) {
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
}
