"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconBrandAndroid,
  IconBrandApple,
  IconChevronDown,
  IconDeviceDesktop,
  IconDeviceMobile,
} from "@tabler/icons-react";
import type { NotificationsGuideContent } from "./content";
import { HelpCallout, HelpStepList } from "./help-components";

type PlatformTab = "android" | "ios" | "desktop";

const TAB_ORDER: PlatformTab[] = ["android", "ios", "desktop"];

function tabFromHash(hash: string): PlatformTab | null {
  const clean = hash.replace(/^#/, "").toLowerCase();
  if (!clean) return null;
  if (clean === "ios" || clean.startsWith("ios-")) return "ios";
  if (clean === "desktop" || clean.startsWith("desktop-")) return "desktop";
  if (clean === "android" || clean.startsWith("android-")) return "android";
  return null;
}

export function NotificationsPlatformGuide({
  content,
}: {
  content: NotificationsGuideContent;
}) {
  const [activeTab, setActiveTab] = useState<PlatformTab>("android");
  const tabRefs = useRef<Record<PlatformTab, HTMLButtonElement | null>>({
    android: null,
    ios: null,
    desktop: null,
  });

  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash;
      const targetTab = tabFromHash(hash);
      if (targetTab) {
        setActiveTab(targetTab);
        const targetId = hash.slice(1);
        requestAnimationFrame(() => {
          const el = document.getElementById(targetId);
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  function selectTab(next: PlatformTab, focusTab = false) {
    setActiveTab(next);
    if (focusTab) {
      tabRefs.current[next]?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, idx: number) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      selectTab(TAB_ORDER[(idx + 1) % TAB_ORDER.length], true);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      selectTab(TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length], true);
    } else if (e.key === "Home") {
      e.preventDefault();
      selectTab(TAB_ORDER[0], true);
    } else if (e.key === "End") {
      e.preventDefault();
      selectTab(TAB_ORDER[TAB_ORDER.length - 1], true);
    }
  }

  return (
    <div>
      <div
        className="help-tabs-bar"
        role="tablist"
        aria-label={content.title}
      >
        <button
          ref={(el) => {
            tabRefs.current.android = el;
          }}
          id="tab-android"
          type="button"
          role="tab"
          aria-selected={activeTab === "android"}
          aria-controls="panel-android"
          tabIndex={activeTab === "android" ? 0 : -1}
          className="help-tab-btn"
          onClick={() => selectTab("android")}
          onKeyDown={(e) => handleKeyDown(e, 0)}
        >
          <IconBrandAndroid size={18} aria-hidden="true" />
          <span>{content.tabs.android}</span>
        </button>

        <button
          ref={(el) => {
            tabRefs.current.ios = el;
          }}
          id="tab-ios"
          type="button"
          role="tab"
          aria-selected={activeTab === "ios"}
          aria-controls="panel-ios"
          tabIndex={activeTab === "ios" ? 0 : -1}
          className="help-tab-btn"
          onClick={() => selectTab("ios")}
          onKeyDown={(e) => handleKeyDown(e, 1)}
        >
          <IconBrandApple size={18} aria-hidden="true" />
          <span>{content.tabs.ios}</span>
        </button>

        <button
          ref={(el) => {
            tabRefs.current.desktop = el;
          }}
          id="tab-desktop"
          type="button"
          role="tab"
          aria-selected={activeTab === "desktop"}
          aria-controls="panel-desktop"
          tabIndex={activeTab === "desktop" ? 0 : -1}
          className="help-tab-btn"
          onClick={() => selectTab("desktop")}
          onKeyDown={(e) => handleKeyDown(e, 2)}
        >
          <IconDeviceDesktop size={18} aria-hidden="true" />
          <span>{content.tabs.desktop}</span>
        </button>
      </div>

      {/* PANEL 1: ANDROID */}
      <div
        id="panel-android"
        role="tabpanel"
        aria-labelledby="tab-android"
        hidden={activeTab !== "android"}
      >
        <div className="help-jump-nav">
          <span className="help-jump-label">{content.android.jumpLabel}</span>
          {content.android.jumps.map((jump) => (
            <a key={jump.href} href={jump.href} className="help-jump-pill">
              {jump.label}
            </a>
          ))}
        </div>

        <section id="android-install" className="help-section">
          <div className="help-section-head">
            <span className="help-section-eyebrow">
              {content.android.installSection.eyebrow}
            </span>
            <h2>{content.android.installSection.title}</h2>
            <p>{content.android.installSection.intro}</p>
          </div>
          <HelpStepList steps={content.android.installSection.steps} />
        </section>

        <section id="android-unblock" className="help-section">
          <div className="help-section-head">
            <span className="help-section-eyebrow">
              {content.android.unblockSection.eyebrow}
            </span>
            <h2>{content.android.unblockSection.title}</h2>
            <p>{content.android.unblockSection.intro}</p>
          </div>
          <HelpCallout
            kind="warning"
            title={content.android.unblockSection.calloutTitle}
            body={content.android.unblockSection.calloutBody}
          />
          <HelpStepList steps={content.android.unblockSection.steps} />
        </section>

        <section id="android-battery" className="help-section">
          <div className="help-section-head">
            <span className="help-section-eyebrow">
              {content.android.batterySection.eyebrow}
            </span>
            <h2>{content.android.batterySection.title}</h2>
            <p>{content.android.batterySection.intro}</p>
          </div>
          <HelpCallout
            kind="info"
            title={content.android.batterySection.calloutTitle}
            body={content.android.batterySection.calloutBody}
          />
          <HelpStepList steps={content.android.batterySection.steps} />

          <div className="help-section-head" style={{ marginTop: "0.75rem" }}>
            <h3 id="vendor-accordion-heading">
              {content.android.batterySection.vendorTitle}
            </h3>
          </div>
          <div
            className="help-vendor-accordion"
            role="region"
            aria-labelledby="vendor-accordion-heading"
          >
            {content.android.batterySection.vendorRows.map((row, idx) => (
              <details
                key={row[0]}
                className="help-vendor-item"
                open={idx === 0}
              >
                <summary className="help-vendor-summary">
                  <span className="help-vendor-title">
                    <IconDeviceMobile size={18} aria-hidden="true" />
                    <span>{row[0]}</span>
                  </span>
                  <IconChevronDown
                    size={18}
                    aria-hidden="true"
                    className="help-vendor-chevron"
                  />
                </summary>
                <dl className="help-vendor-dl">
                  <div className="help-vendor-row">
                    <dt>{content.android.batterySection.vendorHeaders[1]}</dt>
                    <dd>{row[1]}</dd>
                  </div>
                  <div className="help-vendor-row">
                    <dt>{content.android.batterySection.vendorHeaders[2]}</dt>
                    <dd>{row[2]}</dd>
                  </div>
                </dl>
              </details>
            ))}
          </div>
        </section>
      </div>

      {/* PANEL 2: iOS */}
      <div
        id="panel-ios"
        role="tabpanel"
        aria-labelledby="tab-ios"
        hidden={activeTab !== "ios"}
      >
        <section id="ios" className="help-section">
          <div className="help-section-head">
            <h2>{content.tabs.ios}</h2>
          </div>
          <HelpCallout
            kind="info"
            title={content.ios.calloutTitle}
            body={content.ios.calloutBody}
          />
          <HelpStepList steps={content.ios.steps} />
          <HelpCallout
            kind="warning"
            title={content.ios.unblockTitle}
            body={content.ios.unblockBody}
          />
        </section>
      </div>

      {/* PANEL 3: DESKTOP */}
      <div
        id="panel-desktop"
        role="tabpanel"
        aria-labelledby="tab-desktop"
        hidden={activeTab !== "desktop"}
      >
        <section id="desktop" className="help-section">
          <div className="help-section-head">
            <h2>{content.tabs.desktop}</h2>
          </div>
          <HelpCallout
            kind="info"
            title={content.desktop.calloutTitle}
            body={content.desktop.calloutBody}
          />
          <div className="help-card-grid">
            {content.desktop.cards.map((card) => (
              <div key={card.title} className="help-simple-card">
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
