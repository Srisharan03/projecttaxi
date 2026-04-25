"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { getVendorByEmail, updateVendorProfile, type Vendor } from "@/lib/firestore";
import { useAuthStore } from "@/store/authStore";

type VendorWithId = Vendor & { id: string };

export default function VendorProfilePage() {
  const user = useAuthStore((state) => state.user);
  const [vendor, setVendor] = useState<VendorWithId | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadVendor(): Promise<void> {
      const userEmail = user?.email || "";
      if (!userEmail) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const row = await getVendorByEmail(userEmail);
        if (cancelled) {
          return;
        }
        setVendor(row);
        setName(row?.name || "");
        setEmail(row?.email || userEmail);
        setPhone(row?.phone || "");
        setProfileImageUrl(row?.profile_image || "");
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load vendor profile.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadVendor();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const pendingPreviewUrl = useMemo(
    () => (pendingImage ? URL.createObjectURL(pendingImage) : ""),
    [pendingImage],
  );

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) {
        URL.revokeObjectURL(pendingPreviewUrl);
      }
    };
  }, [pendingPreviewUrl]);

  const handleSave = async () => {
    if (!vendor?.id) {
      setError("Vendor account not found.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      let nextImage = profileImageUrl;
      if (pendingImage) {
        nextImage = await uploadImageToCloudinary(pendingImage, `vendor-profile/${vendor.id}`);
      }

      await updateVendorProfile(vendor.id, {
        name,
        email,
        phone,
        profile_image: nextImage,
      });

      setProfileImageUrl(nextImage);
      setPendingImage(null);
      setVendor((current) => (current ? { ...current, name, email, phone, profile_image: nextImage } : current));
      setMessage("Vendor profile updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save vendor profile.");
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <div className="shell" style={{ margin: "2rem auto" }}>
        <Card title="Vendor Profile" subtitle="Please login to manage vendor profile." />
      </div>
    );
  }

  if (!loading && !vendor) {
    return (
      <div className="shell" style={{ margin: "2rem auto", maxWidth: "760px" }}>
        <Card title="Vendor Profile" subtitle="No vendor profile found for this account email.">
          <div className="form-grid">
            <p className="card-subtitle">Register your vendor profile first, then come back here to edit details.</p>
            <Link href="/vendor/register">
              <Button>Go To Vendor Registration</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="shell" style={{ margin: "2rem auto", maxWidth: "760px" }}>
      <Card title="Vendor Profile" subtitle="Manage profile details shown for your vendor account.">
        <div className="form-grid">
          <div className="hero-actions" style={{ justifyContent: "center" }}>
            <Badge tone={loading ? "warning" : "success"}>
              {loading ? "Loading..." : "Ready"}
            </Badge>
          </div>

          <div style={{ display: "grid", justifyItems: "center", gap: "0.75rem" }}>
            <label style={{ width: "100%", maxWidth: "420px" }}>
              <span className="card-subtitle">Profile Image</span>
              <input
                className="input"
                type="file"
                accept="image/*"
                onChange={(event) => setPendingImage(event.target.files?.[0] ?? null)}
              />
            </label>

            {(pendingImage || profileImageUrl) ? (
              <Image
                src={pendingPreviewUrl || profileImageUrl}
                alt="Vendor profile"
                width={220}
                height={220}
                unoptimized
                style={{ width: "140px", height: "140px", borderRadius: "999px", objectFit: "cover", border: "1px solid var(--line-soft)" }}
              />
            ) : (
              <p className="card-subtitle" style={{ textAlign: "center" }}>No profile image uploaded yet.</p>
            )}
          </div>

          <label>
            <span className="card-subtitle">Name</span>
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
          </label>

          <label>
            <span className="card-subtitle">Email</span>
            <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>

          <label>
            <span className="card-subtitle">Phone Number</span>
            <input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>

          <Button onClick={() => void handleSave()} isLoading={busy || loading || !vendor}>
            Save Profile
          </Button>
          {message ? <p className="card-subtitle" style={{ color: "#166534" }}>{message}</p> : null}
          {error ? <p className="card-subtitle" style={{ color: "#b91c1c" }}>{error}</p> : null}
        </div>
      </Card>
    </div>
  );
}
