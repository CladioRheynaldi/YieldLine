import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";

import { anvil, arbitrumSepolia } from "wagmi/chains";

import { chain, rpcUrls } from "./network";

export const wagmiConfig = createConfig({
  chains: [chain],
  connectors: [injected()],
  transports: {
    [anvil.id]: http(rpcUrls[anvil.id]),
    [arbitrumSepolia.id]: http(rpcUrls[arbitrumSepolia.id]),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
