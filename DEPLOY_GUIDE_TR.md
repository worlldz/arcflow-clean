# ArcFlow Deploy Rehberi

Bu projede calisan `.env.local` dosyasi proje kokunde olmalidir:

`C:\Users\PC\Documents\New project\arcflow\.env.local`

`app\.env.local` dosyasini dikkate alma. Next.js dogru olarak kokteki dosyayi okur.

## 1. Gerekli seyler

- MetaMask veya Rabby
- Arc Testnet'e gecis
- test token almak icin Circle Faucet
- X API Bearer Token
- verifier olarak kullanacagin ayr bir test wallet private key

## 2. Arc Testnet ve faucet

1. Sitede `Add Arc Testnet Network` butonuna bas.
2. Cuzdanda ag ekleme penceresi gelirse onayla.
3. Circle faucet'e git:
   [https://faucet.circle.com/](https://faucet.circle.com/)
4. Arc Testnet icin USDC ve EURC al.

## 3. Contract deploy etmenin en kolay yolu: Remix

1. [https://remix.ethereum.org/](https://remix.ethereum.org/) adresini ac.
2. Sol tarafta `contracts` klasoru olustur.
3. Bu projedeki su dosyayi Remix'e kopyala:
   `C:\Users\PC\Documents\New project\arcflow\contracts\ArcFlowTips.sol`
4. Sol menuden `Solidity Compiler` sekmesine gir.
5. Compiler version olarak `0.8.24` sec.
6. `Compile ArcFlowTips.sol` butonuna bas.
7. Sol menuden `Deploy & Run Transactions` sekmesine gir.
8. Environment olarak `Injected Provider - MetaMask` sec.
9. MetaMask'ta Arc Testnet acik olsun.

## 4. Constructor alanlarini doldur

Deploy ederken sirayla bunlari gir:

1. `initialOwner`
   - kendi test wallet adresin
2. `initialVerifier`
   - ikinci bir test wallet adresi
   - sadece test icin ayni adresi de kullanabilirsin
3. `usdc`
   - `0x3600000000000000000000000000000000000000`
4. `eurc`
   - `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`

Sonra `Deploy` butonuna bas.

## 5. Deploy adresini kopyala

Deploy tamamlaninca Remix'te deployed contracts altinda yeni contract gorunecek.
Oradaki contract adresini kopyala.

Bu adres senin `NEXT_PUBLIC_TIPS_CONTRACT` degerin olacak.

## 6. `.env.local` dosyasini doldur

Su dosyayi ac:

`C:\Users\PC\Documents\New project\arcflow\.env.local`

Icine su mantikta gercek degerleri yaz:

```env
NEXT_PUBLIC_TIPS_CONTRACT=BURAYA_REMIX_DEPLOY_ADRESI
X_BEARER_TOKEN=BURAYA_X_BEARER_TOKEN
VERIFIER_PRIVATE_KEY=0xILE_BASLAYAN_PRIVATE_KEY
```

## 7. Bu degerleri nereden alacaksin

### X Bearer Token

1. [https://developer.x.com/](https://developer.x.com/) ac
2. developer hesabina gir
3. bir app olustur
4. app icinden bearer token al
5. bunu `X_BEARER_TOKEN` alanina yapistir

### Verifier Private Key

1. Test icin yeni bir wallet ac
2. o wallet'in private key'ini export et
3. `0x` ile basliyorsa oldugu gibi birak
4. bunu `VERIFIER_PRIVATE_KEY` alanina yapistir

Ana wallet private key'ini kullanma.

## 8. Uygulamayi yeniden baslat

VS Code terminal:

```powershell
cd "C:\Users\PC\Documents\New project\arcflow"
Ctrl + C
npm run dev
```

Sonra tarayicida:

```text
Ctrl + Shift + R
```

## 9. Basarili oldugunu nasil anlarsin

- `Approve USDC` veya `Approve EURC` hata vermez
- `Create Reward` calisir
- olusturulan tip icin ekranda `Tip ID` gorunur
- `Verify & Claim` butonu artik `TIPS_CONTRACT missing` hatasi vermez

## 10. Hala hata varsa

Ilk kontrol edecegin yerler:

1. `.env.local` dosyasi proje kokunde mi
2. `NEXT_PUBLIC_TIPS_CONTRACT` gercek deploy adresi mi
3. `X_BEARER_TOKEN` gercek bearer token mi
4. `VERIFIER_PRIVATE_KEY` gecerli mi
5. dev server `.env.local` duzeltildikten sonra yeniden baslatildi mi
