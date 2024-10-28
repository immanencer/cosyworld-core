// nft-lister.mjs

import { MongoClient } from 'mongodb';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
dotenv.config();

// Define Solana and MongoDB settings
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = process.env.DATABASE_NAME || 'solana';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'walletTokens';
const IMAGE_SAVE_PATH = process.env.IMAGE_SAVE_PATH || './nft_images';

// Utility to ensure IMAGE_SAVE_PATH directory exists
async function ensureImageDirectory() {
  try {
    await fs.access(IMAGE_SAVE_PATH);
  } catch (error) {
    await fs.mkdir(IMAGE_SAVE_PATH, { recursive: true });
    console.log(`Created image directory at ${IMAGE_SAVE_PATH}`);
  }
}

// Validate wallet addresses from environment variable
function parseWalletAddresses(walletsEnv) {
  if (!walletsEnv) {
    console.error('RATICAT_WALLET environment variable is not set.');
    process.exit(1);
  }

  const addresses = walletsEnv.split(',').map(addr => addr.trim()).filter(addr => addr.length > 0);
  const validAddresses = addresses.filter(addr => {
    // Simple validation for wallet addresses
    return addr.length === 44;
  });

  if (validAddresses.length === 0) {
    console.error('No valid wallet addresses provided.');
    process.exit(1);
  }

  return validAddresses;
}

// Fetch all NFTs for a given wallet using Helius API
async function fetchNFTs(walletAddress) {
  try {
    const url = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'fetch-assets',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: walletAddress,
          displayOptions: {
            showCollectionMetadata: true,
            showFungible: true,
            showUnverifiedCollections: true,
            showNativeBalance: true
          },
        },
      }),
    });

    if (!response.ok) {
      console.warn(`Failed to fetch NFTs for wallet ${walletAddress}`);
      return [];
    }

    const { result } = await response.json();
    const assets = result.items;

    if (!assets || assets.length === 0) {
      console.warn(`No assets found for wallet ${walletAddress}`);
      return [];
    }

    const nfts = await Promise.all(assets.map(processAsset));
    return nfts.filter(nft => nft !== null);
  } catch (error) {
    console.error(`Error fetching NFTs for wallet ${walletAddress}:`, error);
    return [];
  }
}

// Process each asset, fetch metadata and save images
async function processAsset(asset) {
  try {
    if (!asset || !asset.content?.json_uri) {
      console.warn(`Invalid asset or missing metadata for ${asset?.id}`);
      return null;
    }

    const metadataURI = asset.content.json_uri;
    let metadataJSON = {};
    try {
      const response = await fetch(metadataURI);
      if (response.ok) {
        metadataJSON = await response.json();
      } else {
        console.warn(`Failed to fetch metadata JSON from ${metadataURI}`);
      }
    } catch (error) {
      console.warn(`Error fetching metadata JSON from ${metadataURI}:`, error);
    }

    // Fetch and save image
    let imagePath = null;
    if (metadataJSON.image) {
      try {
        const imageUrl = metadataJSON.image.startsWith('ipfs://')
          ? `https://ipfs.io/ipfs/${metadataJSON.image.slice(7)}`
          : metadataJSON.image;
        const imageResponse = await fetch(imageUrl);
        if (imageResponse.ok) {
          const buffer = await imageResponse.buffer();
          const imageExtension = path.extname(new URL(imageUrl).pathname) || '.jpg';
          imagePath = path.join(IMAGE_SAVE_PATH, `${asset.id}${imageExtension}`);
          await fs.writeFile(imagePath, buffer);
        } else {
          console.warn(`Failed to fetch image from ${metadataJSON.image}`);
        }
      } catch (error) {
        console.warn(`Error fetching image from ${metadataJSON.image}:`, error);
      }
    }

    return {
      mint: asset.id,
      name: metadataJSON.name || null,
      symbol: metadataJSON.symbol || null,
      uri: metadataURI,
      image: metadataJSON.image || null,
      imagePath: imagePath || null,
      description: metadataJSON.description || null,
      quantity: asset.token_info ? parseFloat(asset.token_info.balance) / Math.pow(10, asset.token_info.decimals) : 1,
      price: asset.token_info ? parseFloat(asset.token_info.price) : 0,
    };
  } catch (error) {
    console.error(`Error processing asset ${asset?.id}:`, error);
    return null;
  }
}

// Update MongoDB with fetched NFT data
async function updateMongoDB(walletAddress, nfts) {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const document = {
      walletAddress,
      nfts,
      lastUpdated: new Date(),
    };

    await collection.updateOne(
      { walletAddress },
      { $set: document },
      { upsert: true }
    );

    // Create markdown report
    const markdownReport = createMarkdownReport(walletAddress, nfts);
    const reportPath = path.join(IMAGE_SAVE_PATH, `${walletAddress}_report.md`);
    await fs.writeFile(reportPath, markdownReport);
    console.log(`Markdown report for wallet ${walletAddress} saved to ${reportPath}`);
  } catch (error) {
    console.error(`Error updating MongoDB for wallet ${walletAddress}:`, error);
  } finally {
    await client.close();
  }
}

// Create a markdown report for the NFTs
function createMarkdownReport(walletAddress, nfts) {
  let report = `# Asset Report for Wallet: ${walletAddress}

`;

  // Separate NFTs and fungible tokens
  const nftsOnly = nfts.filter(nft => !nft.symbol || nft.symbol === 'N/A');
  const fungibleTokens = nfts.filter(nft => nft.symbol && nft.symbol !== 'N/A');

  if (nftsOnly.length > 0) {
    report += `## NFTs

`;
    nftsOnly.forEach((nft, index) => {
      report += `### NFT ${index + 1}
`;
      report += `- **Name**: ${nft.name || 'N/A'}
`;
      report += `- **Description**: ${nft.description || 'N/A'}
`;
      report += `- **Image**: ${nft.image ? `![NFT Image](${nft.image})` : 'N/A'}
`;
      report += `
`;
    });
  }

  if (fungibleTokens.length > 0) {
    report += `## Fungible Tokens

`;
    fungibleTokens.forEach((token, index) => {
      report += `### Token ${index + 1}
`;
      report += `- **Name**: ${token.name || 'N/A'}
`;
      report += `- **Symbol**: ${token.symbol || 'N/A'}
`;
      report += `- **Quantity**: ${token.quantity || 1}
`;
      report += `
`;
    });
  }

  return report;
}

// Main function to process wallets
async function processWallets() {
  await ensureImageDirectory();

  const walletAddresses = parseWalletAddresses(process.env.RATICAT_WALLET);

  for (const wallet of walletAddresses) {
    console.log(`\n---\nProcessing wallet: ${wallet}\n---`);

    // Fetch NFTs
    const nfts = await fetchNFTs(wallet);
    console.log(`Fetched ${nfts.length} assets.`);

    // Update MongoDB
    await updateMongoDB(wallet, nfts);
  }

  console.log('\nAll wallets processed successfully.');
}

// Execute the main function
processWallets().catch(error => {
  console.error('Unexpected error during processing:', error);
  process.exit(1);
});