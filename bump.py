#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bump.py - Prepara una version nueva de CombuAsigna.

El numero de version vive en CUATRO sitios que tienen que coincidir. Si uno se
queda atras, los usuarios siguen ejecutando el codigo viejo aunque la pildora
diga lo contrario:

  1. version.json ......... lo que anuncia la app (y lo que revisa el cliente)
  2. index.html ........... los ?v= de css/js, que son los que rompen el cache
  3. js/main.js ........... APP_CODE_VERSION, la version del codigo que CORRE
  4. CHANGELOG.md ......... la entrada de la version (se avisa, no se escribe)

Uso:
    python bump.py 2.9.2                  # version nueva, actualizacion normal
    python bump.py 2.9.2 --obligatoria    # ademas exige el minimo: nadie se queda atras
    python bump.py --check                # solo revisa que todo este coherente
"""

import io
import json
import os
import re
import sys
from datetime import date

RAIZ = os.path.dirname(os.path.abspath(__file__))


def ruta(*partes):
    return os.path.join(RAIZ, *partes)


def leer(p):
    return io.open(p, encoding="utf-8").read()


def escribir(p, texto):
    io.open(p, "w", encoding="utf-8").write(texto)


def version_actual():
    datos = json.loads(leer(ruta("version.json")))
    return datos.get("version", ""), datos


def versiones_en_index():
    texto = leer(ruta("index.html"))
    return re.findall(r'(?:href|src)="(?:css|js)/[^"?]+\?v=([^"]+)"', texto)


def version_en_main():
    m = re.search(r'window\.APP_CODE_VERSION\s*=\s*"([^"]+)"', leer(ruta("js", "main.js")))
    return m.group(1) if m else None


def revisar():
    """Devuelve la lista de incoherencias encontradas."""
    publicada, datos = version_actual()
    problemas = []

    for v in versiones_en_index():
        if v != publicada:
            problemas.append("index.html tiene ?v=%s y version.json dice %s" % (v, publicada))

    en_main = version_en_main()
    if en_main is None:
        problemas.append("js/main.js no declara APP_CODE_VERSION")
    elif en_main != publicada:
        problemas.append("js/main.js declara %s y version.json dice %s" % (en_main, publicada))

    minima = datos.get("minVersion")
    if minima and comparar(minima, publicada) > 0:
        problemas.append("minVersion (%s) es mayor que version (%s)" % (minima, publicada))

    if ("[%s]" % publicada) not in leer(ruta("CHANGELOG.md")):
        problemas.append("CHANGELOG.md no tiene entrada para [%s]" % publicada)

    return publicada, problemas


def comparar(a, b):
    pa = [int(x) for x in re.findall(r"\d+", a or "0")]
    pb = [int(x) for x in re.findall(r"\d+", b or "0")]
    while len(pa) < len(pb):
        pa.append(0)
    while len(pb) < len(pa):
        pb.append(0)
    return (pa > pb) - (pa < pb)


def aplicar(nueva, obligatoria):
    anterior, datos = version_actual()
    if comparar(nueva, anterior) <= 0:
        print("La version %s no es mayor que la actual (%s)." % (nueva, anterior))
        return 1

    # 1) version.json
    datos["version"] = nueva
    datos["buildDate"] = date.today().isoformat()
    if obligatoria:
        datos["minVersion"] = nueva
    escribir(ruta("version.json"), json.dumps(datos, indent=2, ensure_ascii=False) + "\n")

    # 2) index.html
    html = leer(ruta("index.html"))
    html = re.sub(r'((?:href|src)="(?:css|js)/[^"?]+\?v=)[^"]+"', r'\g<1>%s"' % nueva, html)
    escribir(ruta("index.html"), html)

    # 3) js/main.js
    main = io.open(ruta("js", "main.js"), encoding="utf-8-sig").read()
    main = re.sub(r'(window\.APP_CODE_VERSION\s*=\s*")[^"]+(")', r"\g<1>%s\g<2>" % nueva, main)
    io.open(ruta("js", "main.js"), "w", encoding="utf-8-sig").write(main)

    print("%s -> %s%s" % (anterior, nueva, "  (actualizacion OBLIGATORIA)" if obligatoria else ""))
    print("  version.json, index.html y js/main.js actualizados.")

    _, problemas = revisar()
    pendientes = [p for p in problemas if "CHANGELOG" in p]
    if pendientes:
        print("\nFalta por hacer a mano:")
        for p in pendientes:
            print("  -", p)
    otros = [p for p in problemas if "CHANGELOG" not in p]
    if otros:
        print("\nRevisar:")
        for p in otros:
            print("  -", p)
        return 1
    return 0


def main():
    args = [a for a in sys.argv[1:]]
    if "--check" in args:
        publicada, problemas = revisar()
        if problemas:
            print("Version %s - hay que revisar:" % publicada)
            for p in problemas:
                print("  -", p)
            return 1
        print("Version %s: version.json, index.html, js/main.js y CHANGELOG.md coinciden." % publicada)
        return 0

    obligatoria = "--obligatoria" in args
    sueltos = [a for a in args if not a.startswith("--")]
    if len(sueltos) != 1 or not re.match(r"^\d+\.\d+\.\d+$", sueltos[0]):
        print(__doc__.strip())
        return 1
    return aplicar(sueltos[0], obligatoria)


if __name__ == "__main__":
    sys.exit(main())
