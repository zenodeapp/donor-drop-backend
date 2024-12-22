'use client'

import { useState, useEffect } from 'react'
import type { Web3State } from '../types/web3'

export function useWeb3() {
  const [state, setState] = useState<Web3State>({
    isConnected: false,
    address: null,
    ethRecognized: '0',
    error: null,
  })

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
        setState(prev => ({
          ...prev,
          isConnected: true,
          address: accounts[0],
          error: null
        }))
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: 'Failed to connect wallet'
        }))
      }
    } else {
      setState(prev => ({
        ...prev,
        error: 'Please install MetaMask'
      }))
    }
  }

  const signMessage = async (message: string) => {
    if (!state.isConnected) {
      setState(prev => ({
        ...prev,
        error: 'Wallet not connected'
      }))
      return;
    }

    try {
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, state.address],
      });

      return signature; // The signed message
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Message signing failed'
      }));
      console.error(error);
    }
  }

  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.request({ method: 'eth_accounts' })
        .then((accounts: string | any[]) => {
          if (accounts.length > 0) {
            setState(prev => ({
              ...prev,
              isConnected: true,
              address: accounts[0]
            }))
          }
        })
    }
  }, [])

  return {
    ...state,
    connectWallet,
    signMessage
  }
}
