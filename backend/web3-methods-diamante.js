const DiamanteSdk = require("diamante-sdk-js");
const fs = require("fs");
const utils = require("./utils");

let server, account, contract, keypair;

async function deployContract(contractWasmPath) {
  const contractWasm = fs.readFileSync(contractWasmPath);
  const server = new DiamanteSdk.Horizon.Server(
    "https://diamtestnet.diamcircle.io/"
  );
  const account = await server.loadAccount(keypair.publicKey());

  const transaction = new DiamanteSdk.TransactionBuilder(account, {
    fee: DiamanteSdk.BASE_FEE,
    networkPassphrase: DiamanteSdk.Networks.TESTNET,
  })
    .addOperation(
      DiamanteSdk.Operation.deployContract({
        sourceAccount: keypair.publicKey(),
        wasm: contractWasm,
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(keypair);
  const result = await server.submitTransaction(transaction);
  console.log("Transaction result:", result);
  // Extract contract ID from result
  const contractId = result.result.results[0].contractId;
  console.log("Contract ID:", contractId);
  return contractId;
}

async function fundTestnetAccount(publicKey) {
  try {
    const response = await fetch(
      `https://friendbot.diamtestnet.diamcircle.io?addr=${encodeURIComponent(
        publicKey
      )}`
    );
    const responseJSON = await response.json();
    return responseJSON;
  } catch (e) {
    console.error("ERROR!", e);
  }
}

const initializeWeb3 = async () => {
  if (server && account && contract) return;

  server = new DiamanteSdk.Horizon.Server("https://diamtestnet.diamcircle.io/");

  keypair = DiamanteSdk.Keypair.random();
  console.log("Public Key:", keypair.publicKey());
  console.log("Secret Key:", keypair.secret());

  const res = await fundTestnetAccount(keypair.publicKey());
  console.log("Funding result:", res);
  account = await server.loadAccount(keypair.publicKey());
  console.log("Account balances:", account.balances);

  // Deploy the contract
  const contractId = await deployContract("./path/to/your/contract.wasm");
  contract = new DiamanteSdk.Contract(contractId);
};

const getBlocksData = async () => {
  await initializeWeb3();
  const result = await contract.call("getter");
  return utils.processJSONforBigInt(result);
};

const addBlock = async (ipfs, camp) => {
  await initializeWeb3();

  const transaction = new DiamanteSdk.TransactionBuilder(account, {
    fee: DiamanteSdk.BASE_FEE,
    networkPassphrase: DiamanteSdk.Networks.TESTNET,
  })
    .addOperation(contract.call("setter", [ipfs, camp]))
    .setTimeout(30)
    .build();

  transaction.sign(keypair);
  const result = await server.submitTransaction(transaction);

  return utils.processJSONforBigInt(result);
};

const getAccounts = async () => {
  await initializeWeb3();
  return [account.accountId()];
};

module.exports = {
  initializeWeb3,
  getBlocksData,
  addBlock,
  getAccounts,
};