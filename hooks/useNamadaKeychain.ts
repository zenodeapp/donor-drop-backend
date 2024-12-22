'use client';

import { useState, useCallback } from "react";
import { WindowWithNamada } from "@namada/types";

// Type Definitions
export type InjectedNamada = WindowWithNamada["namada"];

const notAvailableError = "Namada Keychain is not available.";

// NamadaKeychain Class
class NamadaKeychain {
  install(): void {
    console.warn(
      "Namada is not available. Redirecting to the Namada download page..."
    );
    window.open("https://www.namada.net/extension", "_blank");
  }

  private async _get(): Promise<InjectedNamada | undefined> {
    if ((window as WindowWithNamada).namada) {
      return (window as WindowWithNamada).namada;
    }

    if (document.readyState === "complete") {
      return (window as WindowWithNamada).namada;
    }

    return new Promise<InjectedNamada | undefined>((resolve) => {
      const documentStateChange = (event: Event): void => {
        if (
          event.target &&
          (event.target as Document).readyState === "complete"
        ) {
          resolve((window as WindowWithNamada).namada);
          document.removeEventListener("readystatechange", documentStateChange);
        }
      };

      document.addEventListener("readystatechange", documentStateChange);
    });
  }

  async get(): Promise<InjectedNamada | undefined> {
    const namada = await this._get();
    return namada;
  }

  async connect(chainId: string): Promise<void> {
    const namada = await this.get();
    if (!namada) {
      throw new Error(notAvailableError);
    }
    await namada.connect(chainId);
  }

  async getAccounts(): Promise<string[]> {
    const namada = await this.get();
    if (!namada) {
      throw new Error(notAvailableError);
    }

    const accounts = await namada.accounts(); // Assuming `accounts` is a valid method
    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found in Namada wallet.");
    }

    return accounts.map((account) => account.address); // Extract addresses
  }
}

// useNamadaKeychain Hook
export const useNamadaKeychain = (chainId: string | null) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const namadaKeychain = new NamadaKeychain();

  const connect = useCallback(async () => {
    if (!chainId || isConnected || isConnecting) return;

    setIsConnecting(true);
    try {
      await namadaKeychain.connect(chainId);
      setIsConnected(true);

      // Fetch wallet address
      const accounts = await namadaKeychain.getAccounts();
      setAddress(accounts[0] || null); // Use the first account as active
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setIsConnecting(false);
    }
  }, [chainId, isConnected, isConnecting]);

  return { connect, isConnected, isConnecting, address, error, namadaKeychain };
};

