"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Check, Eye, EyeOff, Lock, Mail, Shield, Trash2, Upload } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { Organization, TeamMember } from "@/lib/types";
import { getInitials } from "@/lib/utils";

interface ProfileViewProps {
  currentUser: TeamMember;
  organization: Organization;
  canEditEmail?: boolean;
  onRefreshState: () => Promise<void>;
  onNotify: (msg: string) => void;
}

const MAX_RAW_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const TARGET_AVATAR_PX = 256;
const MAX_DATA_URL_LENGTH = 180_000;

export async function optimizeAvatarImage(file: File): Promise<{ dataUrl: string; sizeKb: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Não foi possível decodificar a imagem selecionada."));
      el.src = objectUrl;
    });

    const side = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
    if (!side) {
      throw new Error("Dimensões da imagem inválidas.");
    }

    const sx = Math.floor(((img.naturalWidth || img.width) - side) / 2);
    const sy = Math.floor(((img.naturalHeight || img.height) - side) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = TARGET_AVATAR_PX;
    canvas.height = TARGET_AVATAR_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Navegador não suporta processamento de imagem.");
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, side, side, 0, 0, TARGET_AVATAR_PX, TARGET_AVATAR_PX);

    let dataUrl = canvas.toDataURL("image/webp", 0.8);
    if (!dataUrl.startsWith("data:image/webp")) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    }
    if (dataUrl.length > MAX_DATA_URL_LENGTH) {
      const retryMime = dataUrl.startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
      dataUrl = canvas.toDataURL(retryMime, 0.58);
    }

    const base64Len = dataUrl.split(",")[1]?.length ?? 0;
    const estimatedBytes = Math.ceil((base64Len * 3) / 4);
    const sizeKb = Math.max(1, Math.round(estimatedBytes / 1024));
    return { dataUrl, sizeKb };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ProfileView({
  currentUser,
  organization,
  canEditEmail = false,
  onRefreshState,
  onNotify,
}: ProfileViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [optimizedSizeKb, setOptimizedSizeKb] = useState<number | null>(null);

  const [emailInput, setEmailInput] = useState(currentUser.email);
  const [savingEmail, setSavingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setEmailInput(currentUser.email);
  }, [currentUser.email]);

  const { firstName, lastName } = useMemo(() => {
    const parts = currentUser.name.trim().split(/\s+/);
    if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: "" };
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(" "),
    };
  }, [currentUser.name]);

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditEmail) return;
    const trimmed = emailInput.trim();
    if (!trimmed) {
      onNotify("Informe um e-mail válido.");
      return;
    }
    setSavingEmail(true);
    try {
      await apiClient.updateProfileEmail(trimmed);
      await onRefreshState();
      onNotify("E-mail atualizado com sucesso.");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Erro ao atualizar e-mail.");
    } finally {
      setSavingEmail(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
      onNotify("Formato não suportado. Envie PNG, JPEG ou WebP.");
      return;
    }
    if (file.size > MAX_RAW_FILE_BYTES) {
      onNotify("A imagem excede o limite de 15 MB.");
      return;
    }

    setUploadingPhoto(true);
    try {
      const { dataUrl, sizeKb } = await optimizeAvatarImage(file);
      await apiClient.updateProfileAvatar(dataUrl);
      setOptimizedSizeKb(sizeKb);
      await onRefreshState();
      onNotify(`Foto de perfil atualizada e otimizada (${sizeKb} KB).`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Erro ao atualizar foto de perfil.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleConfirmRemovePhoto = async () => {
    setRemovingPhoto(true);
    try {
      await apiClient.updateProfileAvatar(null);
      setOptimizedSizeKb(null);
      setConfirmRemoveOpen(false);
      await onRefreshState();
      onNotify("Foto de perfil removida.");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Erro ao remover foto de perfil.");
    } finally {
      setRemovingPhoto(false);
    }
  };

  const passwordMismatch =
    confirmPassword.length > 0 && newPassword.length > 0 && newPassword !== confirmPassword;

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      onNotify("Informe sua senha atual para confirmar.");
      return;
    }
    if (newPassword.length < 6) {
      onNotify("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      onNotify("A confirmação da nova senha não confere.");
      return;
    }

    setSavingPassword(true);
    try {
      await apiClient.updateProfilePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onNotify("Senha atualizada com sucesso.");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Erro ao alterar senha.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="thin-scrollbar h-full overflow-y-auto bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Cabeçalho da conta */}
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-base font-bold text-slate-900">Minha conta</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Informações do seu perfil, foto otimizada e credenciais de acesso.
          </p>
        </div>

        {/* Foto de perfil + Nome completo */}
        <div className="space-y-6 border-b border-slate-100 px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="h-16 w-16 shrink-0 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                  style={{ backgroundColor: currentUser.avatarBg }}
                >
                  {getInitials(currentUser.name)}
                </div>
              )}
              <div>
                <div className="text-sm font-bold text-slate-900">Foto de perfil</div>
                <p className="mt-0.5 text-xs text-slate-500">
                  PNG, JPEG ou WebP até 15 MB · otimizada automaticamente (256×256 WebP)
                  {optimizedSizeKb !== null ? ` · ${optimizedSizeKb} KB` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                {uploadingPhoto ? "Otimizando..." : "Enviar nova foto"}
              </button>
              <button
                type="button"
                disabled={!currentUser.avatarUrl || removingPhoto}
                onClick={() => setConfirmRemoveOpen(true)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remover
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-sm font-bold text-slate-900">Nome completo</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-500">Nome</label>
                <input
                  type="text"
                  value={firstName}
                  readOnly
                  disabled
                  className="mt-1 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Sobrenome</label>
                <input
                  type="text"
                  value={lastName}
                  readOnly
                  disabled
                  placeholder="—"
                  className="mt-1 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                />
              </div>
            </div>
          </div>
        </div>

        {/* E-mail de acesso (editável apenas para Desenvolvedor e Administrador) */}
        <form onSubmit={handleSaveEmail} className="space-y-3 border-b border-slate-100 px-6 py-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900">E-mail de acesso</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {canEditEmail
                ? "Seu e-mail é utilizado para login no workspace."
                : "Seu e-mail é usado para login no workspace e não pode ser alterado."}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">E-mail</label>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-[260px] flex-1 sm:max-w-md">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={canEditEmail ? emailInput : currentUser.email}
                  readOnly={!canEditEmail}
                  disabled={!canEditEmail}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className={
                    canEditEmail
                      ? "w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                      : "w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-600"
                  }
                />
              </div>
              {canEditEmail ? (
                <button
                  type="submit"
                  disabled={
                    savingEmail ||
                    !emailInput.trim() ||
                    emailInput.trim().toLowerCase() === currentUser.email.toLowerCase()
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  {savingEmail ? "Salvando..." : "Salvar e-mail"}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                  <Lock className="h-3.5 w-3.5" /> Alteração bloqueada
                </span>
              )}
            </div>
          </div>
        </form>

        {/* Senha */}
        <form onSubmit={handleSavePassword} className="space-y-4 border-b border-slate-100 px-6 py-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Senha</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Informe sua senha atual e repita duas vezes a nova senha (mínimo de 6 caracteres).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-slate-500">Senha atual</label>
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showCurrentPw ? "text" : "password"}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  title={showCurrentPw ? "Ocultar" : "Mostrar"}
                >
                  {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500">Nova senha</label>
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showNewPw ? "text" : "password"}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  title={showNewPw ? "Ocultar" : "Mostrar"}
                >
                  {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500">Confirmar nova senha</label>
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showConfirmPw ? "text" : "password"}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  title={showConfirmPw ? "Ocultar" : "Mostrar"}
                >
                  {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {passwordMismatch && (
            <p className="text-xs font-medium text-red-600">
              A confirmação da nova senha não coincide com a nova senha digitada.
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingPassword || passwordMismatch || !currentPassword || newPassword.length < 6}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Lock className="h-3.5 w-3.5" />
              {savingPassword ? "Atualizando..." : "Salvar nova senha"}
            </button>
          </div>
        </form>

        {/* Conta vinculada / acesso no workspace (somente visualização) */}
        <div className="space-y-3 px-6 py-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Acesso no workspace</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Vínculo atual e nível de permissão atribuído à sua conta.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">{organization.name}</div>
                  <div className="text-[11px] text-slate-500">Organização ativa · {organization.niche}</div>
                </div>
              </div>
              <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                Conectado
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">{currentUser.roleName}</div>
                  <div className="text-[11px] text-slate-500">Perfil de acesso atribuído pelo administrador</div>
                </div>
              </div>
              <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                {currentUser.isActive ? "Ativo" : "Inativo"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: confirmar remoção da foto */}
      {confirmRemoveOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => !removingPhoto && setConfirmRemoveOpen(false)}
            className="absolute inset-0 cursor-default"
          />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Remover foto de perfil</h3>
            </div>
            <p className="mt-3 text-xs text-slate-600">
              Deseja remover sua foto de perfil atual? Suas iniciais voltarão a ser exibidas no lugar da imagem.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRemoveOpen(false)}
                disabled={removingPhoto}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRemovePhoto}
                disabled={removingPhoto}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> {removingPhoto ? "Removendo..." : "Remover"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
