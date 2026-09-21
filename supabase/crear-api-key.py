#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
crear-api-key.py - Genera una credencial para un cliente de la API externa.

La key se muestra UNA SOLA VEZ, aqui en pantalla. En la base solo queda su
SHA-256, asi que no hay forma de recuperarla: si el cliente la pierde, se
revoca y se emite otra. Eso es deliberado — si la base se filtrara, las keys
no se podrian reconstruir.

Uso:
    python crear-api-key.py "Transportes XYZ"
    python crear-api-key.py "Transportes XYZ" --bases "BASE 3" --limite 240
    python crear-api-key.py "Transportes XYZ" --expira 2027-01-31

    python crear-api-key.py --revocar ck_a1b2c3d4     # SQL para desactivarla
"""

import argparse
import hashlib
import secrets
import sys

PREFIJO = "ck_"          # "combuses key", para reconocerla de un vistazo
LONGITUD_SECRETO = 40    # caracteres del cuerpo aleatorio


def generar_key():
    """Devuelve (key_en_claro, sha256_hex, prefijo_visible)."""
    # token_urlsafe usa el generador criptografico del sistema.
    cuerpo = secrets.token_urlsafe(32)[:LONGITUD_SECRETO]
    key = PREFIJO + cuerpo
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return key, digest, key[:11]


def sql_escape(texto):
    return str(texto).replace("'", "''")


def main():
    p = argparse.ArgumentParser(add_help=True, description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("nombre", nargs="?", help="Nombre del cliente")
    p.add_argument("--bases", default="BASE 3",
                   help="Bases que puede consultar, separadas por coma (por defecto: BASE 3)")
    p.add_argument("--limite", type=int, default=240,
                   help="Tope de consultas por hora (por defecto: 240)")
    p.add_argument("--expira", default=None,
                   help="Fecha de caducidad AAAA-MM-DD (por defecto: sin caducidad)")
    p.add_argument("--revocar", metavar="PREFIJO",
                   help="Genera el SQL para desactivar la key con ese prefijo")
    args = p.parse_args()

    if args.revocar:
        print("-- Desactivar la credencial (no se borra: se conserva para auditoria)")
        print("update public.api_clientes set activo = false")
        print("where key_prefijo = '%s';" % sql_escape(args.revocar))
        return 0

    if not args.nombre:
        p.print_help()
        return 1

    bases = [b.strip() for b in args.bases.split(",") if b.strip()]
    if not bases:
        print("Hay que indicar al menos una base.")
        return 1

    key, digest, prefijo = generar_key()
    bases_sql = ", ".join("'%s'" % sql_escape(b) for b in bases)
    expira_sql = "'%s'" % sql_escape(args.expira) if args.expira else "null"

    print("=" * 72)
    print("CREDENCIAL PARA:  %s" % args.nombre)
    print("=" * 72)
    print()
    print("  API KEY:  %s" % key)
    print()
    print("  Esta key NO se vuelve a mostrar y no queda guardada en ningun")
    print("  sitio. Entregala por un canal seguro (no por correo ni WhatsApp);")
    print("  si se pierde, se revoca y se emite otra.")
    print()
    print("  Bases:    %s" % ", ".join(bases))
    print("  Limite:   %d consultas/hora" % args.limite)
    print("  Caduca:   %s" % (args.expira if args.expira else "sin caducidad"))
    print()
    print("-" * 72)
    print("SQL para registrarla (pegar en el SQL Editor de Supabase):")
    print("-" * 72)
    print()
    print("insert into public.api_clientes")
    print("  (nombre, key_hash, key_prefijo, bases, limite_hora, expira_en, notas)")
    print("values (")
    print("  '%s'," % sql_escape(args.nombre))
    print("  '%s'," % digest)
    print("  '%s'," % prefijo)
    print("  array[%s]," % bases_sql)
    print("  %d," % args.limite)
    print("  %s," % expira_sql)
    print("  'Alta desde crear-api-key.py'")
    print(");")
    print()
    print("-" * 72)
    print("Comprobar que quedo bien (no muestra la key, solo el prefijo):")
    print("-" * 72)
    print()
    print("select id, nombre, key_prefijo, bases, activo, limite_hora, expira_en")
    print("from public.api_clientes order by id desc limit 5;")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
