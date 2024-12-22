export interface DonationTransaction {
  hash: string
  message: string
  amount: string
}

export interface Web3State {
  isConnected: boolean
  address: string | null
  ethRecognized: string
  error: string | null
}


