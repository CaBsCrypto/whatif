import dotenv from 'dotenv';
dotenv.config();

import { WalletService } from './src/services/walletService';

async function test() {
    console.log("=========================================");
    console.log("🔍 QuantumAlpha - Validación de Billeteras");
    console.log("=========================================\n");

    try {
        const wallets = await WalletService.getWallets();
        
        if (wallets.length === 0) {
            console.log("❌ No se pudieron cargar las billeteras. Verifica tu archivo .env");
        } else {
            console.log("✅ Billeteras detectadas correctamente:");
            wallets.forEach(w => {
                console.log(`\nRed: ${w.network.toUpperCase()}`);
                console.log(`Dirección Pública: ${w.address}`);
                w.balances.forEach(b => {
                    console.log(`Balance: ${b.balance} ${b.symbol}`);
                });
            });
            console.log("\n✅ ¡Validación exitosa!");
        }
    } catch (e) {
        console.error("\n❌ Error grave probando billeteras:", e);
    }
    process.exit(0);
}

test();
