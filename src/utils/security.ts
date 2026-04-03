import { RSA } from 'react-native-rsa-native';
import { error } from './common';

interface CryptoResult {
  success: boolean;
  data?: string;
  error?: string;
}

export const encrypt = async (publicKey: string, data: string): Promise<CryptoResult> => {
  try {
    const encrypted = await RSA.encrypt(data, publicKey);
    return { success: true, data: encrypted };
  } catch (err) {
    error('Error in Encryption', err);
    return { success: false, error: 'Failed to encrypt data' };
  }
};

export const decrypt = async (privateKey: string, encryptedData: string): Promise<CryptoResult> => {
  try {
    const decrypted = await RSA.decrypt(encryptedData, privateKey);
    return { success: true, data: decrypted };
  } catch (err) {
    error('Error in Decryption', err);
    return { success: false, error: 'Failed to decrypt data' };
  }
};

export const convertKeyToPem = (publicKeyXml: any) => {
  const forge = require('node-forge');
  // Extract Modulus and Exponent from XML
  const modulusBase64 = publicKeyXml.match(/<Modulus>([^<]+)<\/Modulus>/)[1];
  const exponentBase64 = publicKeyXml.match(/<Exponent>([^<]+)<\/Exponent>/)[1];

  // Decode Base64
  const modulusBytes = forge.util.decode64(modulusBase64);
  const exponentBytes = forge.util.decode64(exponentBase64);

  // Convert to BigInteger
  const modulus = new forge.jsbn.BigInteger(forge.util.bytesToHex(modulusBytes), 16);
  const exponent = new forge.jsbn.BigInteger(forge.util.bytesToHex(exponentBytes), 16);

  // Create Public Key Object
  const publicKey = forge.pki.setRsaPublicKey(modulus, exponent);

  // Convert to PEM format
  const pemPublicKey = forge.pki.publicKeyToPem(publicKey);

  return pemPublicKey;
};
