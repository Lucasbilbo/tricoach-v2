-- Migration 006: `profiles.contexto` tenía como valor por defecto el TEXTO 'null'.
-- 44 de 50 perfiles lo tenían y el coach recibía "Contexto del atleta: null" en el prompt.
-- El código ya ignora 'null' (defensivo); esto limpia el origen.
-- NO aplicada todavía: pendiente de OK de Lucas.

ALTER TABLE profiles ALTER COLUMN contexto DROP DEFAULT;
UPDATE profiles SET contexto = NULL WHERE contexto = 'null';
