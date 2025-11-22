/**
 * Mini Blockchain Implementation
 * A complete blockchain system using only vanilla JavaScript
 */

class Block {
    /**
     * Creates a new block in the blockchain
     * @param {number} index - Position of block in chain
     * @param {Array} transactions - List of transactions in this block
     * @param {string} previousHash - Hash of the previous block
     */
    constructor(index, transactions, previousHash = '') {
        this.index = index;
        this.timestamp = new Date().toISOString();
        this.transactions = transactions;
        this.previousHash = previousHash;
        this.nonce = 0; // Number used once - for proof of work
        this.hash = ''; // Will be calculated
    }

    /**
     * Calculates SHA-256 hash of the block
     * Uses Web Crypto API for secure hashing
     */
    async calculateHash() {
        // Combine all block data into a single string
        const data = this.index + 
                    this.timestamp + 
                    JSON.stringify(this.transactions) + 
                    this.previousHash + 
                    this.nonce;
        
        // Convert string to bytes
        const encoder = new TextEncoder();
        const dataBytes = encoder.encode(data);
        
        // Calculate SHA-256 hash
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
        
        // Convert hash to hexadecimal string
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Mines the block using Proof of Work algorithm
     * Finds a hash that starts with a certain number of zeros
     * @param {number} difficulty - Number of leading zeros required
     */
    async mineBlock(difficulty) {
        // Create target string (e.g., "000" for difficulty 3)
        const target = Array(difficulty + 1).join("0");
        
        console.log(`Mining block ${this.index}...`);
        const startTime = Date.now();
        
        // Keep trying different nonce values until hash meets difficulty
        while (this.hash.substring(0, difficulty) !== target) {
            this.nonce++; // Increment nonce
            this.hash = await this.calculateHash(); // Recalculate hash
            
            // Show progress every 5000 attempts with UI update
            if (this.nonce % 5000 === 0) {
                console.log(`Attempt ${this.nonce}: ${this.hash}`);
                showStatus(`Mining block ${this.index}... Attempt ${this.nonce}`, 'info');
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        
        const endTime = Date.now();
        console.log(`Block mined: ${this.hash}`);
        console.log(`Mining took ${endTime - startTime}ms with ${this.nonce} attempts`);
    }
}

class Transaction {
    /**
     * Creates a new transaction
     * @param {string} fromAddress - Sender's address
     * @param {string} toAddress - Receiver's address  
     * @param {number} amount - Amount to transfer
     */
    constructor(fromAddress, toAddress, amount) {
        this.fromAddress = fromAddress;
        this.toAddress = toAddress;
        this.amount = amount;
        this.timestamp = new Date().toISOString();
        this.signature = null;
    }

    /**
     * Creates a hash of the transaction for signing
     */
    async calculateHash() {
        const data = this.fromAddress + this.toAddress + this.amount + this.timestamp;
        const encoder = new TextEncoder();
        const dataBytes = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Signs the transaction with a private key
     * @param {CryptoKey} privateKey - Private key for signing
     */
    async signTransaction(privateKey) {
        // Calculate transaction hash
        const hash = await this.calculateHash();
        
        // Convert hash to bytes for signing
        const encoder = new TextEncoder();
        const hashBytes = encoder.encode(hash);
        
        // Sign the hash
        const signature = await crypto.subtle.sign(
            {
                name: "ECDSA",
                hash: {name: "SHA-256"}
            },
            privateKey,
            hashBytes
        );
        
        // Convert signature to base64 for storage
        const signatureArray = Array.from(new Uint8Array(signature));
        this.signature = btoa(String.fromCharCode.apply(null, signatureArray));
    }

    /**
     * Verifies the transaction signature
     * @param {CryptoKey} publicKey - Public key for verification
     */
    async isValid(publicKey) {
        // Genesis transactions don't need signatures
        if (this.fromAddress === null) return true;
        
        if (!this.signature || this.signature.length === 0) {
            throw new Error('No signature in this transaction');
        }

        // Calculate transaction hash
        const hash = await this.calculateHash();
        const encoder = new TextEncoder();
        const hashBytes = encoder.encode(hash);
        
        // Convert signature from base64 to bytes
        const signatureBytes = Uint8Array.from(atob(this.signature), c => c.charCodeAt(0));
        
        // Verify signature
        return await crypto.subtle.verify(
            {
                name: "ECDSA",
                hash: {name: "SHA-256"}
            },
            publicKey,
            signatureBytes,
            hashBytes
        );
    }
}

class Blockchain {
    constructor() {
        this.chain = [];
        this.difficulty = 2; // Mining difficulty (number of leading zeros)
        this.pendingTransactions = [];
        this.miningReward = 100;
    }

    /**
     * Creates the genesis block (first block in chain)
     */
    async createGenesisBlock() {
        const genesisBlock = new Block(0, [], "0");
        genesisBlock.hash = await genesisBlock.calculateHash();
        this.chain = [genesisBlock];
        console.log("Genesis block created!");
        return genesisBlock;
    }

    /**
     * Gets the latest block in the chain
     */
    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    /**
     * Adds a new block to the chain
     * @param {Array} transactions - Transactions to include in the block
     */
    async addBlock(transactions) {
        if (this.chain.length === 0) {
            throw new Error("Create genesis block first!");
        }

        const previousBlock = this.getLatestBlock();
        const newBlock = new Block(
            this.chain.length,
            transactions,
            previousBlock.hash
        );

        // Mine the block (Proof of Work)
        await newBlock.mineBlock(this.difficulty);
        
        // Add to chain
        this.chain.push(newBlock);
        console.log("Block added to chain!");
        return newBlock;
    }

    /**
     * Validates the entire blockchain
     * Checks if all blocks are properly linked and valid
     */
    async isChainValid() {
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            // Recalculate current block's hash
            const recalculatedHash = await currentBlock.calculateHash();
            if (currentBlock.hash !== recalculatedHash) {
                console.log(`Block ${i} has been tampered with!`);
                return false;
            }

            // Check if current block points to previous block
            if (currentBlock.previousHash !== previousBlock.hash) {
                console.log(`Block ${i} is not properly linked!`);
                return false;
            }

            // Verify mining (hash starts with required zeros)
            const target = Array(this.difficulty + 1).join("0");
            if (currentBlock.hash.substring(0, this.difficulty) !== target) {
                console.log(`Block ${i} was not properly mined!`);
                return false;
            }
        }

        console.log("Blockchain is valid!");
        return true;
    }

    /**
     * Tampers with a block (for demonstration)
     * @param {number} blockIndex - Index of block to tamper with
     */
    tamperWithBlock(blockIndex) {
        if (blockIndex >= 0 && blockIndex < this.chain.length) {
            // Change some data in the block
            this.chain[blockIndex].transactions.push({
                fromAddress: "HACKER",
                toAddress: "HACKER_WALLET", 
                amount: 999999,
                timestamp: new Date().toISOString()
            });
            console.log(`Block ${blockIndex} has been tampered with!`);
        }
    }
}

// Global variables for the application
let blockchain = new Blockchain();
let keyPair = null;

/**
 * Generates a new key pair for digital signatures
 */
async function generateKeyPair() {
    try {
        keyPair = await crypto.subtle.generateKey(
            {
                name: "ECDSA",
                namedCurve: "P-256"
            },
            true,
            ["sign", "verify"]
        );
        
        // Export public key for display
        const publicKeyBuffer = await crypto.subtle.exportKey("spki", keyPair.publicKey);
        const publicKeyArray = Array.from(new Uint8Array(publicKeyBuffer));
        const publicKeyBase64 = btoa(String.fromCharCode.apply(null, publicKeyArray));
        
        document.getElementById('publicKey').textContent = publicKeyBase64.substring(0, 50) + '...';
        showStatus('Key pair generated successfully!', 'success');
    } catch (error) {
        showStatus('Error generating key pair: ' + error.message, 'error');
    }
}

/**
 * Creates the genesis block
 */
async function createGenesisBlock() {
    try {
        showStatus('Creating genesis block...', 'info');
        showMiningAnimation();
        await new Promise(resolve => setTimeout(resolve, 1500));
        await blockchain.createGenesisBlock();
        hideMiningAnimation();
        displayBlockchain();
        showStatus('Genesis block created successfully!', 'success');
    } catch (error) {
        hideMiningAnimation();
        showStatus('Error creating genesis block: ' + error.message, 'error');
    }
}

/**
 * Creates and adds a new transaction
 */
async function addTransaction() {
    const sender = document.getElementById('sender').value;
    const receiver = document.getElementById('receiver').value;
    const amount = parseFloat(document.getElementById('amount').value);

    if (!sender || !receiver || !amount) {
        showStatus('Please fill all transaction fields!', 'error');
        return;
    }

    if (!keyPair) {
        showStatus('Please generate a key pair first!', 'error');
        return;
    }

    try {
        showStatus('Creating transaction...', 'info');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Create transaction
        const transaction = new Transaction(sender, receiver, amount);
        
        showStatus('Signing transaction...', 'info');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Sign transaction
        await transaction.signTransaction(keyPair.privateKey);
        
        showStatus('Mining new block...', 'info');
        showMiningAnimation();
        
        // Add placeholder block with animation
        addPlaceholderBlock();
        
        // Add to blockchain
        await blockchain.addBlock([transaction]);
        
        hideMiningAnimation();
        
        // Clear form
        document.getElementById('sender').value = '';
        document.getElementById('receiver').value = '';
        document.getElementById('amount').value = '';
        
        displayBlockchain();
        showStatus('Transaction added successfully!', 'success');
    } catch (error) {
        hideMiningAnimation();
        showStatus('Error adding transaction: ' + error.message, 'error');
    }
}

/**
 * Validates the entire blockchain
 */
async function validateBlockchain() {
    try {
        const isValid = await blockchain.isChainValid();
        if (isValid) {
            showStatus('Blockchain is VALID! ✅', 'success');
        } else {
            showStatus('Blockchain is INVALID! ❌', 'error');
        }
        displayBlockchain();
    } catch (error) {
        showStatus('Error validating blockchain: ' + error.message, 'error');
    }
}

/**
 * Tampers with a random block for demonstration
 */
function tamperWithBlock() {
    if (blockchain.chain.length <= 1) {
        showStatus('Need at least 2 blocks to demonstrate tampering!', 'error');
        return;
    }
    
    // Tamper with a random block (not genesis)
    const randomIndex = Math.floor(Math.random() * (blockchain.chain.length - 1)) + 1;
    blockchain.tamperWithBlock(randomIndex);
    
    displayBlockchain();
    showStatus(`Block ${randomIndex} has been tampered with! Run validation to see the effect.`, 'info');
}

/**
 * Displays the blockchain in the UI
 */
async function displayBlockchain() {
    const container = document.getElementById('blockchain');
    
    // Remove mining placeholder if exists
    const placeholder = document.getElementById('mining-placeholder');
    if (placeholder) {
        placeholder.remove();
    }
    
    if (blockchain.chain.length === 0) {
        container.innerHTML = '<p>No blocks in chain. Create genesis block first!</p>';
        return;
    }

    // Check if chain is valid for styling
    const isValid = await blockchain.isChainValid();

    // Clear and rebuild with animation
    container.innerHTML = '';
    
    for (let i = 0; i < blockchain.chain.length; i++) {
        const block = blockchain.chain[i];
        const blockElement = document.createElement('div');
        blockElement.className = `block ${isValid ? 'valid' : 'invalid'}`;
        
        // Add chain connection animation for non-genesis blocks
        if (i > 0) {
            blockElement.classList.add('chain-connecting');
        }
        
        // Check individual block validity
        let blockValid = true;
        if (i > 0) {
            const recalculatedHash = await block.calculateHash();
            const previousBlock = blockchain.chain[i - 1];
            blockValid = (block.hash === recalculatedHash) && 
                        (block.previousHash === previousBlock.hash);
        }
        
        if (!blockValid) {
            blockElement.className = 'block invalid';
        }

        blockElement.innerHTML = `
            <div class="block-header">
                <div class="block-info">
                    <strong>Index:</strong>
                    <span>${block.index}</span>
                </div>
                <div class="block-info">
                    <strong>Timestamp:</strong>
                    <span>${new Date(block.timestamp).toLocaleString()}</span>
                </div>
                <div class="block-info">
                    <strong>Nonce:</strong>
                    <span>${block.nonce}</span>
                </div>
            </div>
            
            <div class="block-info">
                <strong>Previous Hash:</strong>
                <span>${block.previousHash || 'Genesis Block'}</span>
            </div>
            
            <div class="block-info">
                <strong>Current Hash:</strong>
                <span>${block.hash}</span>
            </div>
            
            <div class="transactions">
                <h4>Transactions (${block.transactions.length}):</h4>
                ${block.transactions.length === 0 ? 
                    '<p>No transactions</p>' : 
                    block.transactions.map(tx => `
                        <div class="transaction">
                            <strong>From:</strong> ${tx.fromAddress || 'Genesis'}<br>
                            <strong>To:</strong> ${tx.toAddress}<br>
                            <strong>Amount:</strong> ${tx.amount}<br>
                            <strong>Signed:</strong> ${tx.signature ? '✅' : '❌'}
                        </div>
                    `).join('')
                }
            </div>
        `;
        
        container.appendChild(blockElement);
    }
}

/**
 * Shows status messages to the user
 */
function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = 'status';
    }, 5000);
}

/**
 * Shows mining animation
 */
function showMiningAnimation() {
    document.getElementById('miningAnimation').style.display = 'block';
}

/**
 * Hides mining animation
 */
function hideMiningAnimation() {
    document.getElementById('miningAnimation').style.display = 'none';
}

/**
 * Adds a placeholder block during mining
 */
function addPlaceholderBlock() {
    const container = document.getElementById('blockchain');
    const placeholder = document.createElement('div');
    placeholder.className = 'block block-creating';
    placeholder.id = 'mining-placeholder';
    placeholder.innerHTML = `
        <div class="block-header">
            <div class="block-info">
                <strong>Status:</strong>
                <span>⛏️ Mining in progress...</span>
            </div>
        </div>
    `;
    container.appendChild(placeholder);
}

// Initialize the application when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Generate initial key pair
    generateKeyPair();
    
    // Display empty blockchain
    displayBlockchain();
    
    console.log('Mini Blockchain application initialized!');
});