import { useEffect, useLayoutEffect, useRef } from 'react'
import { connect, signMessage, watchConnections } from '@wagmi/core'
// @ts-ignore
import { config, IS_ELECTRON, appKitModal } from './web3-config'
import { injected } from '@wagmi/connectors'
import { WagmiAPI } from './services/wagmi-api'

import { animate, stagger, utils } from 'animejs'
import logo from './assets/newicon.png';
import './App.css'

// Keep track of SIWE to prevent duplicate triggers
let siweInProgressCount = 0;

async function handleSiweFlow(address: string) {
  if (siweInProgressCount > 0) {
    console.warn("[App] SIWE flow already in progress, skipping duplicate call for:", address);
    return;
  }
  siweInProgressCount++;
  console.log("3. SIWE Flow Started for:", address);

  try {
    const msgData = await WagmiAPI.getSiweMessage(address);
    console.log("4. Message Received from Backend:", msgData);

    if (!msgData.ok || !msgData.message) {
      console.error("Failed to get SIWE message from backend:", msgData);
      return;
    }

    console.log("5a. Requesting signature from wallet...");
    const signature = await signMessage(config, { message: msgData.message });
    console.log("5b. Signature Obtained:", signature);

    console.log("6a. Verifying signature on backend...");
    const result = await WagmiAPI.verifySiweMessage(msgData.message, signature);
    console.log("6b. Verification Result:", result);

    if (result.ok) {
      const dashboardUrl = import.meta.env.VITE_DASHBOARD_URL || "http://localhost:3001";
      const target = dashboardUrl.replace(/\/?$/, "/dashboard/");
      console.log("7. Redirecting to:", target);
      window.location.href = target;
    } else {
      console.error("Verification failed on backend:", result);
    }
  } catch (err) {
    console.error("SIWE Flow FATAL Error:", err);
  } finally {
    siweInProgressCount = 0;
  }
}

async function loginHandler() {
  console.log("1. Login Button Clicked");
  if (IS_ELECTRON && appKitModal) {
    console.info("2. Opening AppKit modal...");
    return appKitModal.open();
  }

  try {
    const { accounts } = await connect(config, { connector: injected() });
    console.log("2. Wallet Connected:", accounts[0]);
    await handleSiweFlow(accounts[0]);
  } catch (err) {
    console.error("Connection Error:", err);
  }
}


function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const setInitialStyles = (selector: string, styles: Partial<CSSStyleDeclaration>) => {
      document.querySelectorAll(selector).forEach((el) => {
        Object.assign((el as HTMLElement).style, styles)
      })
    }

    setInitialStyles('.logo-icon', { transform: 'scale(0) rotate(45deg)' })
    setInitialStyles('.subtitle', { opacity: '0', transform: 'translateY(20px)' })
    setInitialStyles('.coming-soon .word', { opacity: '0', transform: 'translateY(30px) scale(0.8)' })
    setInitialStyles('.divider', { transform: 'scaleX(0)' })
    setInitialStyles('.description', { opacity: '0', transform: 'translateY(20px)' })
    setInitialStyles('.notify-form', { opacity: '0', transform: 'translateY(30px)' })
  }, [])

  useEffect(() => {
    animate('.logo-icon', {
      scale: 1,
      rotate: 0,
      duration: 1200,
      ease: 'outElastic(1, 0.5)',
    })

    animate('.subtitle', {
      opacity: 1,
      translateY: 0,
      duration: 1000,
      delay: 800,
      ease: 'outExpo',
    })

    animate('.coming-soon .word', {
      opacity: 1,
      translateY: 0,
      scale: 1,
      duration: 1000,
      delay: stagger(150, { start: 1000 }),
      ease: 'outExpo',
    })

    animate('.divider', {
      scaleX: 1,
      duration: 1200,
      delay: 1400,
      ease: 'outExpo',
    })

    if (document.querySelector('.description')) {
      animate('.description', {
        opacity: 1,
        translateY: 0,
        duration: 1000,
        delay: 1600,
        ease: 'outExpo',
      })
    }

    if (document.querySelector('.notify-form')) {
      animate('.notify-form', {
        opacity: 1,
        translateY: 0,
        duration: 1000,
        delay: 1800,
        ease: 'outExpo',
      })
    }

    if (particlesRef.current) {
      particlesRef.current.innerHTML = ''
      for (let i = 0; i < 50; i += 1) {
        const particle = document.createElement('div')
        particle.className = 'particle'
        particle.style.left = `${Math.random() * 100}%`
        particle.style.top = `${Math.random() * 100}%`
        particle.style.width = `${Math.random() * 4 + 2}px`
        particle.style.height = particle.style.width
        particle.style.opacity = `${Math.random() * 0.5 + 0.1}`
        particlesRef.current.appendChild(particle)
      }

      animate('.particle', {
        translateX: () => utils.random(-100, 100),
        translateY: () => utils.random(-100, 100),
        scale: () => utils.random(0.5, 1.5),
        opacity: () => utils.random(0.3, 0.6),
        duration: () => utils.random(3000, 6000),
        delay: () => utils.random(0, 2000),
        alternate: true,
        loop: true,
        ease: 'inOutSine',
      })
    }

    animate('.gradient-orb', {
      scale: [1, 1.2, 1],
      duration: 8000,
      alternate: true,
      loop: true,
      ease: 'inOutSine',
    })

  }, [])

  // Auto-SIWE for Electron when wallet connects via modal
  useEffect(() => {
    if (!IS_ELECTRON || !config) return;

    const unwatch = watchConnections(config, {
      async onChange(connections) {
        if (connections.length > 0 && siweInProgressCount === 0) {
          const address = connections[0].accounts[0];

          console.info("[App] Wallet connected, checking session for:", address);
          // Check if we ALREADY have a session for this address to avoid redirect loops
          const session = await WagmiAPI.getWalletSession();
          if (session?.ok && session?.address?.toLowerCase() === address.toLowerCase()) {
            console.info("[App] Active session found for this wallet, redirecting to dashboard...");
            const dashboardUrl = import.meta.env.VITE_DASHBOARD_URL || "http://localhost:3001";
            const target = dashboardUrl.replace(/\/?$/, "/dashboard/");
            window.location.href = target;
            return;
          }

          console.info("[App] No active session found, triggering SIWE...");
          handleSiweFlow(address);
        }
      }
    });

    return () => unwatch();
  }, []);

  return (
    <div className="app" ref={containerRef}>
      <div className="background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
        <div className="particles" ref={particlesRef}></div>
        <div className="grid-overlay"></div>
      </div>

      <main className="content">
        <div className="logo-container">
          <div className="logo-icon">
            <img src={logo} alt="Wealth Wards" className="logo-img" />
          </div>
        </div>

        <h1 className="title">Your Financial Guardian</h1>
        <p className="subtitle"></p>

        <div className="coming-soon-container">
          <div className="coming-soon">
            <span className="word">Wealth</span>
            <span className="word">Wards</span>
          </div>
        </div>

        <div className="divider"></div>

        {/* <p className="description">
          We&apos;re building something extraordinary to help you protect and grow your wealth.
          <br />
          Be the first to know when we launch.
        </p> */}

        <button onClick={loginHandler} className="connect-dashboard-btn">
          {IS_ELECTRON ? "Connect Wallet" : "Connect MetaMask"}
        </button>

        {/* <form className="notify-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="email"
              placeholder="Enter your email"
              className="email-input"
              aria-label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
            <button type="submit" className="notify-btn" disabled={isLoading}>
              {isLoading ? (
                <div className="spinner" />
              ) : (
                <>
                  <span>Notify Me</span>
                  <svg className="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </form> */}

        <div className="social-links">
          <a href="#" className="social-link" aria-label="Twitter">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a href="#" className="social-link" aria-label="LinkedIn">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </a>
          <a href="#" className="social-link" aria-label="GitHub">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
        </div>
      </main>

      <footer className="footer">
        <p>&copy; 2026 Wealth Wards. All rights reserved.</p>
      </footer>

    </div>
  )
}

export default App
