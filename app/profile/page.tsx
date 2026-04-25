"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { getUserProfile, upsertUserProfile } from "@/lib/firestore";
import { useAuthStore } from "@/store/authStore";
import "@/styles/profile.css";

export default function UserProfilePage() {
  const user = useAuthStore((state) => state.user);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(): Promise<void> {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const profile = await getUserProfile(user.uid);
        if (cancelled) {
          return;
        }
        setName(profile?.name || user.displayName || "");
        setEmail(profile?.email || user.email || "");
        setPhone(profile?.phone || "");
        setProfileImageUrl(profile?.profile_image || "");
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load user profile.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfile();
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
    if (!user?.uid) {
      setError("Login required.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      let nextImage = profileImageUrl;
      if (pendingImage) {
        nextImage = await uploadImageToCloudinary(pendingImage, `user-profile/${user.uid}`);
      }

      await upsertUserProfile(user.uid, {
        name,
        email,
        phone,
        profile_image: nextImage,
      });
      setProfileImageUrl(nextImage);
      setPendingImage(null);
      setMessage("Profile updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save profile.");
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <div className="shell profile-shell">
        <Card title="User Profile" subtitle="Please login to manage your profile." />
      </div>
    );
  }

  return (
    <div className="shell profile-shell profile-shell-narrow">
      <Card title="User Profile" subtitle="Manage your account details.">
        <div className="form-grid">
          <div className="profile-status-row">
            <Badge tone={loading ? "warning" : "success"}>{loading ? "Loading..." : "Ready"}</Badge>
          </div>

          <div className="profile-image-section">
            <label className="profile-image-input-wrap">
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
                alt="User profile"
                width={220}
                height={220}
                unoptimized
                className="profile-avatar"
              />
            ) : (
              <p className="card-subtitle profile-empty-image-note">No profile image uploaded yet.</p>
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

          <Button onClick={() => void handleSave()} isLoading={busy || loading}>
            Save Profile
          </Button>
          {message ? <p className="card-subtitle profile-note-success">{message}</p> : null}
          {error ? <p className="card-subtitle profile-note-error">{error}</p> : null}
        </div>
      </Card>
    </div>
  );
}
