'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWeb3 } from '../hooks/useWeb3'
import { useNamadaKeychain } from '../hooks/useNamadaKeychain'


interface PublicDonation {
  timestamp: string;
  message: string;
  amount: string;
  ethAddress: string;
}
export default function DonorDrop() {
  const {
    isConnected: isMetaMaskConnected,
    address: ethAddress,
    error: metaMaskError,
    connectWallet: connectMetaMask,
  } = useWeb3()

  const chainId = 'namada.5f5de2dd1b88cba30586420'
  const {
    connect: connectNamada,
    isConnected: isNamadaConnected,
    address: namadaAddress,
    error: namadaError,
  } = useNamadaKeychain(chainId)

  const [message, setMessage] = useState('')
  const [donations, setDonations] = useState([]) // State to hold the donations
  const [totalDonated, setTotalDonated] = useState('0.00') // Initialize to '0.00'
  const [totalDonors, setTotalDonors] = useState('0') // Initialize to '0'
  const [ethRecognized, setEthRecognized] = useState('0.00'); // State to hold the recognized ETH

  // Fetch donations when MetaMask connects
  useEffect(() => {
    const fetchDonations = async () => {
      if (isMetaMaskConnected && ethAddress) {
        try {
          const response = await fetch(`/api/verifytxn?fromAddress=${ethAddress}`);
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          const data = await response.json();
          if (data.transactionHashes.length > 0) {
            const formattedDonations = data.transactionHashes.map((hash: any, index: number) => ({
              hash,
              message: `Donation ${index + 1}`, // You can customize messages here
              amount: data.totalDonation.toString(), // Assuming totalDonation is the same for all, customize as needed
            }));

            setDonations(formattedDonations);
            setTotalDonated(data.totalDonation); // Update total donated if needed
            setTotalDonors(formattedDonations.length.toString()); // Update total donors
            setEthRecognized(data.totalDonation.toString()); // Set recognized ETH from the response
          }
        } catch (error) {
          console.error('Failed to fetch donations:', error);
        }
      }
    };

    fetchDonations();
  }, [isMetaMaskConnected, ethAddress]); // Run effect when wallet connects

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-mono mb-2">Namada Donor Drop</h1>
        <p className="text-red-500 font-mono">
          {totalDonated} / {totalDonors} ETH donated
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AboutSection />
        <MetamaskInstructions />
        <RecentDonations donations={donations} /> {/* Pass donations to RecentDonations */}
        <DonorDropCheck
          ethAddress={ethAddress}
          namadaAddress={namadaAddress}
          message={message}
          setMessage={setMessage}
          isMetaMaskConnected={isMetaMaskConnected}
          isNamadaConnected={isNamadaConnected}
          connectMetaMask={connectMetaMask}
          connectNamada={connectNamada}
          ethRecognized={ethRecognized} // Use the updated ethRecognized state
          metaMaskError={metaMaskError}
          namadaError={namadaError}
        />
      </div>

      <p className="text-sm text-muted-foreground mt-4 text-center">
        NAMADA DONOR DROP
      </p>
    </div>
  )
}

function AboutSection() {
  return (
    <Card className="p-6 bg-[#fefcd3]">
      <h2 className="font-mono mb-4">About Coin Center</h2>
    </Card>
  )
}

function MetamaskInstructions() {
  return (
    <Card className="p-6 bg-[#fefcd3]">
      <h2 className="font-mono mb-4">MetaMask Instructions</h2>
      <ol className="list-decimal list-inside space-y-2 font-mono">
        <li>Have tnam address ready</li>
        <li>Show hex data</li>
        <li>Expand view</li>
        <li>
          Send ETH
          <ul className="ml-6 mt-1">
            <li>a) Recipient: coincenter.eth</li>
            <li>b) Memo: put tnam address here</li>
          </ul>
        </li>
      </ol>
      <p className="text-red-500 mt-4 text-sm font-mono">
        Minimum 0.05 maximum 0.30 ETH only
      </p>
    </Card>
  )
}
// Define the type for individual donation
interface Donation {
  hash: string;
  message: string;
  amount: string;
}

interface RecentDonationsProps {
  donations: Donation[];
}

function RecentDonations({ donations }: RecentDonationsProps) {
  // Check if there are donations
  if (donations.length === 0) {
    return (
      <Card className="p-6">
        <h2 className="font-mono mb-4">Recent Donations</h2>
        <p>No recent donations available.</p>
      </Card>
    );
  }

  // Get the last donation
  const lastDonation = donations[donations.length - 1];
  const shortHash = `${lastDonation.hash.slice(0, 6)}..${lastDonation.hash.slice(-2)}`; // Shorten the hash

  return (
    <Card className="p-6">
      <h2 className="font-mono mb-4">My Recent Donations</h2>
      <div className="flex justify-between font-mono">
        <div>
          <a
            href={`https://etherscan.io/tx/${lastDonation.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            <span className="text-muted-foreground">{shortHash}</span>
          </a>
          <span className="ml-4">{lastDonation.message}</span>
        </div>
        <span>{lastDonation.amount} ETH</span>
      </div>
    </Card>
  );
}


interface PublicDonation {
  timestamp: string;
  message: string;
  amount: string;
  ethAddress: string;
}
function PublicRecentDonation() {
  const [publicDonation, setPublicDonation] = useState<PublicDonation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPublicDonation = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/recentdonation');
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.json();

        // Validate and set the donation data
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          const [timestamp, message, amount, ethAddress] = data.data[0];
          setPublicDonation({
            timestamp,
            message,
            amount,
            ethAddress,
          });
        } else {
          setPublicDonation(null);
        }
      } catch (error) {
        console.error('Failed to fetch public donation:', error);
        setError('Failed to load public donation.'); // Set error message
      } finally {
        setLoading(false);
      }
    };

    fetchPublicDonation();
  }, []);

  if (loading) {
    return <p>Loading public donation...</p>;
  }

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  if (!publicDonation) {
    return <p>No public donation available.</p>;
  }

  const { timestamp, message, amount, ethAddress } = publicDonation;
  const shortEthAddress = `${ethAddress.slice(0, 6)}...${ethAddress.slice(-4)}`;
  const formattedDate = new Date(timestamp).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="mt-4 border-t pt-4">
      <h3 className="font-mono mb-2 text-lg">Public Recent Donation</h3>
      <div className="flex justify-between font-mono">
        <a
          href={`https://etherscan.io/address/${ethAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {`ETH Address: ${shortEthAddress}`}
        </a>
        <span>{`Message: ${message}`}</span>
        <span>{`Amount: ${Number(amount).toFixed(2)} ETH`}</span>
        <span>{`Date: ${formattedDate}`}</span>
      </div>
    </div>
  );
}

interface DonorDropCheckProps {
  ethAddress: string | null
  namadaAddress: string | null
  message: string
  setMessage: (value: string) => void
  isMetaMaskConnected: boolean
  isNamadaConnected: boolean
  connectMetaMask: () => void
  connectNamada: () => void
  ethRecognized: string
  metaMaskError: string | null
  namadaError: string | null
}

function DonorDropCheck({
  ethAddress,
  namadaAddress,
  message,
  setMessage,
  isMetaMaskConnected,
  isNamadaConnected,
  connectMetaMask,
  connectNamada,
  ethRecognized,
  metaMaskError,
  namadaError,
}: DonorDropCheckProps) {
  const recognizedAmount = parseFloat(ethRecognized); // Parse the recognized ETH as a number
  const minRequiredEth = 0.002; // Minimum required ETH for submission

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      message,
      recognizedAmount: ethRecognized,
      namadaAddress,
      ethAddress,
    };

    try {
      const response = await fetch('/api/saveToSheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        alert('Message submitted successfully!');
        setMessage('');
      } else {
        alert('Failed to submit the message. Please try again later.');
      }
    } catch (error) {
      console.error('Error submitting the message:', error);
      alert('An error occurred while submitting the message.');
    }
  };

  return (
    <Card className="p-6">
      <h2 className="font-mono mb-4">Check Your Donor Drop</h2>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => {
              if (!isMetaMaskConnected) connectMetaMask();
            }}
            variant="outline"
            className="bg-[#fefcd3]"
            disabled={isMetaMaskConnected}
          >
            {isMetaMaskConnected ? 'MetaMask Connected' : 'Connect to MetaMask'}
          </Button>
          <span className="text-red-500 font-mono">{ethRecognized} ETH recognized</span>
        </div>

        {metaMaskError && <p className="text-red-500 font-mono">{metaMaskError}</p>}

        <div className="space-y-2">
          <label className="block font-mono">Ethereum Address</label>
          <Input
            value={ethAddress || ''}
            readOnly
            placeholder="Not connected"
          />
        </div>

        <div className="flex items-center gap-4">
          <Button
            onClick={() => {
              if (!isNamadaConnected) connectNamada();
            }}
            variant="outline"
            className="bg-[#fefcd3]"
            disabled={isNamadaConnected}
          >
            {isNamadaConnected ? 'Namada Connected' : 'Connect to Namada Keychain'}
          </Button>
        </div>

        {namadaError && <p className="text-red-500 font-mono">{namadaError}</p>}

        <div className="space-y-2">
          <label className="block font-mono">Namada Address</label>
          <Input
            value={namadaAddress || ''}
            readOnly
            placeholder="Not connected"
          />
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block font-mono">Message</label>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message here"
          />
          <Button
            type="submit"
            className="mt-4"
            disabled={recognizedAmount < minRequiredEth} // Disable if recognized ETH is less than 0.002
          >
            Submit
          </Button>
          {recognizedAmount < minRequiredEth && (
            <p className="text-red-500 mt-2">
              You need at least donate 0.002 ETH to submit your message.
            </p>
          )}
        </form>
      </div>
    </Card>
  );
}

