import csv
import io
import json
import random
import sys
import unicodedata
from datetime import date, timedelta
from pathlib import Path

BASE = Path(__file__).parent
PLANILHAS = BASE / "planilhas"
ESPERADO = BASE / "esperado"
CABECALHO = ["Data", "Rodada", "ID Partida", "Partida", "Time", "Nick", "Minutos", "Kills", "Venceu?"]
PREMIO_CENTAVOS = 1_000_000
PERCENTUAIS = [50, 30, 20]
SO_ESPERADO = "--so-esperado" in sys.argv

site_oficial: dict[str, dict] = {}


def round_robin(times):
    ts = list(times)
    if len(ts) % 2:
        ts.append(None)
    n = len(ts)
    rodadas = []
    for _ in range(n - 1):
        jogos = [(ts[i], ts[n - 1 - i]) for i in range(n // 2) if ts[i] and ts[n - 1 - i]]
        rodadas.append(jogos)
        ts = [ts[0], ts[-1]] + ts[1:-1]
    return rodadas


def gerar_torneio(rng, elencos, id_base, data_inicio, vencedor_de, minutos_especiais=None):
    minutos_especiais = minutos_especiais or {}
    partidas = []
    proximo_id = id_base
    for r, jogos in enumerate(round_robin(list(elencos)), start=1):
        dia = data_inicio + timedelta(days=7 * ((r - 1) // 2) + ((r - 1) % 2))
        for a, b in jogos:
            duracao = rng.randint(25, 45)
            venc = vencedor_de(a, b)
            jogadores = []
            for time in (a, b):
                for nick in elencos[time]:
                    kills = rng.randint(6, 26) if time == venc else rng.randint(1, 18)
                    jogadores.append({
                        "nick": nick,
                        "time": time,
                        "minutos": minutos_especiais.get((r, nick), duracao),
                        "kills": kills,
                    })
            partidas.append({
                "id": f"#{proximo_id}",
                "data": dia.isoformat(),
                "rodada": r,
                "times": [a, b],
                "vencedor": venc,
                "jogadores": jogadores,
            })
            proximo_id += rng.randint(3, 97)
    return partidas


def para_linhas(partidas):
    linhas = []
    for p in partidas:
        a, b = p["times"]
        for j in p["jogadores"]:
            linhas.append({
                "Data": date.fromisoformat(p["data"]).strftime("%d/%m/%Y"),
                "Rodada": str(p["rodada"]),
                "ID Partida": p["id"],
                "Partida": f"{a} x {b}",
                "Time": j["time"],
                "Nick": j["nick"],
                "Minutos": str(j["minutos"]),
                "Kills": str(j["kills"]),
                "Venceu?": "sim" if j["time"] == p["vencedor"] else "não",
            })
    return linhas


def salvar_csv(nome, linhas, cabecalho=CABECALHO, separador=";"):
    if SO_ESPERADO:
        return
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=cabecalho, delimiter=separador, lineterminator="\r\n",
                       extrasaction="ignore")
    w.writeheader()
    w.writerows(linhas)
    (PLANILHAS / nome).write_bytes(buf.getvalue().encode("utf-8-sig"))


def registrar_no_site(partidas, **extras):
    for p in partidas:
        site_oficial[p["id"]] = {**p, **extras.get(p["id"], {})}


def chave_alfabetica(nome):
    sem_acento = "".join(c for c in unicodedata.normalize("NFD", nome) if not unicodedata.combining(c))
    return (sem_acento.casefold(), nome)


def dividir_maior_resto(total, pesos):
    soma = sum(pesos.values())
    valores = {n: total * p // soma for n, p in pesos.items()}
    resto = {n: total * p % soma for n, p in pesos.items()}
    sobra = total - sum(valores.values())
    ordem = sorted(pesos, key=lambda n: (-resto[n], chave_alfabetica(n)))
    extras = set(ordem[:sobra])
    for n in extras:
        valores[n] += 1
    return valores, extras


def calcular(partidas, premio=PREMIO_CENTAVOS):
    vitorias, kills_time, minutos = {}, {}, {}
    for p in partidas:
        for t in p["times"]:
            vitorias.setdefault(t, 0)
            kills_time.setdefault(t, 0)
        vitorias[p["vencedor"]] += 1
        for j in p["jogadores"]:
            kills_time[j["time"]] += j["kills"]
            minutos.setdefault(j["time"], {}).setdefault(j["nick"], 0)
            minutos[j["time"]][j["nick"]] += j["minutos"]

    ordem = sorted(vitorias, key=lambda t: (-vitorias[t], -kills_time[t], t))
    grupos, i = [], 0
    while i < len(ordem):
        chave = (vitorias[ordem[i]], kills_time[ordem[i]])
        g = [t for t in ordem[i:] if (vitorias[t], kills_time[t]) == chave]
        grupos.append(g)
        i += len(g)

    premio_time, posicao, criterio = {}, 1, {}
    for g in grupos:
        pct = sum(PERCENTUAIS[k - 1] for k in range(posicao, posicao + len(g)) if k <= len(PERCENTUAIS))
        total = premio * pct // 100
        valores, _ = dividir_maior_resto(total, dict.fromkeys(g, 1))
        for t in g:
            premio_time[t] = valores[t]
            criterio[t] = "divisão igual (empate em vitórias e kills)" if len(g) > 1 else ""
        posicao += len(g)

    for t in ordem:
        if any(vitorias[o] == vitorias[t] and o != t for o in ordem) and not criterio[t]:
            criterio[t] = "desempate por kills do time"

    classificacao = [{"time": t, "vitorias": vitorias[t], "kills_time": kills_time[t],
                      "premio_centavos": premio_time[t], "criterio": criterio[t]} for t in ordem]

    jogadores = []
    for t, valor in premio_time.items():
        if valor == 0:
            continue
        mins = minutos[t]
        total_min = sum(mins.values())
        base, _ = dividir_maior_resto(valor, mins)
        for n in sorted(mins):
            jogadores.append({"time": t, "nick": n, "minutos": mins[n], "minutos_time": total_min,
                              "premio_centavos": base[n]})
    return classificacao, jogadores


def salvar_esperado(nome, partidas, premio=PREMIO_CENTAVOS):
    classificacao, jogadores = calcular(partidas, premio)
    fmt = lambda c: f"{c // 100},{c % 100:02d}"
    with open(ESPERADO / f"{nome}-classificacao.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["Posição", "Time", "Vitórias", "Kills do time", "Prêmio (R$)", "Critério"])
        chave = lambda c: (c["vitorias"], c["kills_time"])
        for c in classificacao:
            posicao = 1 + sum(1 for o in classificacao if chave(o) > chave(c))
            w.writerow([posicao, c["time"], c["vitorias"], c["kills_time"], fmt(c["premio_centavos"]), c["criterio"]])
    with open(ESPERADO / f"{nome}-jogadores.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["Time", "Nick", "Minutos", "Minutos do time", "Prêmio (R$)"])
        for j in jogadores:
            w.writerow([j["time"], j["nick"], j["minutos"], j["minutos_time"], fmt(j["premio_centavos"])])
    soma = sum(j["premio_centavos"] for j in jogadores)
    assert soma == premio, f"{nome}: soma {soma} != prêmio {premio}"
    return classificacao


def vencedor_por_ranking(ranking):
    return lambda a, b: a if ranking.index(a) < ranking.index(b) else b


SETEMBRO_40923 = {
    "minutos": 38,
    "vencedor": "Falcões",
    "kills": {"Falk": 14, "Kiwi": 11, "Dudu.pro": 16, "Marreta": 13, "Sol": 8,
              "Sombra": 7, "Pantera_X": 12, "Mel": 9, "Tchê": 10, "Rafa.K": 7},
}
SETEMBRO_NICK_CORRETO = {"xxsniperxx": "xXSniperXx"}


def partidas_setembro():
    with open(PLANILHAS / "torneio-setembro.csv", encoding="utf-8-sig", newline="") as f:
        linhas = list(csv.DictReader(f, delimiter=";"))
    partidas, vistos = {}, set()
    for l in linhas:
        nick = SETEMBRO_NICK_CORRETO.get(l["Nick"], l["Nick"])
        chave = (l["ID Partida"], l["Time"], nick)
        if chave in vistos:
            continue
        vistos.add(chave)
        p = partidas.setdefault(l["ID Partida"], {
            "id": l["ID Partida"],
            "data": "-".join(reversed(l["Data"].split("/"))),
            "rodada": int(l["Rodada"]),
            "times": l["Partida"].split(" x "),
            "vencedor": None,
            "jogadores": [],
        })
        if p["id"] == "#40923":
            minutos, kills = SETEMBRO_40923["minutos"], SETEMBRO_40923["kills"][nick]
            p["vencedor"] = SETEMBRO_40923["vencedor"]
        else:
            minutos, kills = int(l["Minutos"]), int(l["Kills"])
            if l["Venceu?"] == "sim":
                p["vencedor"] = l["Time"]
        p["jogadores"].append({"nick": nick, "time": l["Time"], "minutos": minutos, "kills": kills})
    return list(partidas.values())


ELENCOS_6 = {
    "Dragões": ["Fogaréu", "Escama", "Brasa.gg", "Rugido", "Labareda"],
    "Fênix": ["Cinzas", "Phoenix_BR", "Plumada", "Renasce", "Chama.exe"],
    "Leões": ["Juba", "Rei_Leao", "Garra", "Savana", "Rugir99"],
    "Lobos-Guará": ["Guará", "Cerrado", "Uivo", "Pata.Leve", "Ruivo"],
    "Ursos": ["Panda", "Hibernar", "Mel.zinho", "Urso_Polar", "Pardo"],
    "Águias": ["Bico", "Asa.Alta", "Rapina", "Voo_Livre", "Harpia"],
}
ELENCOS_8 = {
    **ELENCOS_6,
    "Jaguares": ["Pintado", "Onça", "Jaguar.br", "Mata", "Felino"],
    "Gaviões": ["Gavião", "Rasante", "Penas", "Alto.Voo", "Caçador"],
}


def main():
    PLANILHAS.mkdir(exist_ok=True)
    ESPERADO.mkdir(exist_ok=True)
    resumo = {}

    rng = random.Random(1)
    ranking = list(ELENCOS_6)
    p01 = gerar_torneio(rng, ELENCOS_6, 51003, date(2026, 10, 3), vencedor_por_ranking(ranking),
                        minutos_especiais={(2, "Escama"): 17, (4, "Cinzas"): 22})
    salvar_csv("01-limpa.csv", para_linhas(p01))
    registrar_no_site(p01)
    resumo["01"] = salvar_esperado("01-limpa", p01)

    rng = random.Random(2)
    p02 = gerar_torneio(rng, ELENCOS_6, 52011, date(2026, 10, 3), vencedor_por_ranking(ranking))
    registrar_no_site(p02)
    linhas02 = para_linhas(p02)
    id_real = p02[4]["id"]
    id_errado = id_real[:-2] + id_real[-1] + id_real[-2]
    if id_errado == id_real or id_errado in site_oficial:
        id_errado = id_real + "0"
    for l in linhas02:
        if l["ID Partida"] == id_real:
            l["ID Partida"] = id_errado
    salvar_csv("02-id-inexistente.csv", linhas02)
    resumo["02"] = {"id_real": id_real, "id_errado": id_errado,
                    "classificacao": salvar_esperado("02-id-inexistente", p02)}

    rng = random.Random(3)
    p03 = gerar_torneio(rng, ELENCOS_6, 53007, date(2026, 10, 3), vencedor_por_ranking(ranking))
    registrar_no_site(p03)
    linhas03 = para_linhas(p03)
    divergencias = []
    alvos = [(1, "Juba", "Kills", +10), (3, "Plumada", "Minutos", -12), (5, "Harpia", "Kills", -4)]
    for rodada, nick, campo, delta in alvos:
        for l in linhas03:
            if l["Rodada"] == str(rodada) and l["Nick"] == nick:
                site = int(l[campo])
                l[campo] = str(max(0, site + delta))
                divergencias.append({"partida": l["ID Partida"], "nick": nick, "campo": campo,
                                     "planilha": l[campo], "site": str(site)})
    salvar_csv("03-divergencias.csv", linhas03)
    resumo["03"] = {"divergencias": divergencias, "classificacao": salvar_esperado("03-divergencias", p03)}

    rng = random.Random(4)
    resultados = {
        frozenset(("Dragões", x)): "Dragões" for x in ELENCOS_6 if x != "Dragões"
    }
    resultados.update({frozenset((x, "Águias")): x for x in ("Fênix", "Leões", "Lobos-Guará", "Ursos")})
    resultados.update({
        frozenset(("Fênix", "Leões")): "Fênix", frozenset(("Fênix", "Lobos-Guará")): "Fênix",
        frozenset(("Fênix", "Ursos")): "Ursos", frozenset(("Leões", "Lobos-Guará")): "Leões",
        frozenset(("Leões", "Ursos")): "Leões", frozenset(("Lobos-Guará", "Ursos")): "Lobos-Guará",
    })
    p04 = gerar_torneio(rng, ELENCOS_6, 54019, date(2026, 10, 3),
                        lambda a, b: resultados[frozenset((a, b))])
    kt = lambda t: sum(j["kills"] for p in p04 for j in p["jogadores"] if j["time"] == t)
    diff = kt("Fênix") - kt("Leões")
    for p in p04:
        for j in p["jogadores"]:
            if diff and j["time"] == "Leões" and j["kills"] + diff >= 0:
                j["kills"] += diff
                diff = 0
    assert kt("Fênix") == kt("Leões")
    salvar_csv("04-empate-em-kills.csv", para_linhas(p04))
    registrar_no_site(p04)
    resumo["04"] = salvar_esperado("04-empate-em-kills", p04)

    rng = random.Random(5)
    p05 = gerar_torneio(rng, ELENCOS_8, 55023, date(2026, 10, 3), vencedor_por_ranking(list(ELENCOS_8)))
    salvar_csv("05-oito-times.csv", para_linhas(p05))
    registrar_no_site(p05)
    resumo["05"] = salvar_esperado("05-oito-times", p05)

    rng = random.Random(6)
    p06 = gerar_torneio(rng, ELENCOS_6, 56029, date(2026, 10, 3), vencedor_por_ranking(ranking))
    salvar_csv("06a-coluna-faltando.csv", para_linhas(p06), cabecalho=[c for c in CABECALHO if c != "Kills"])
    salvar_csv("06b-separador-virgula.csv", para_linhas(p06), separador=",")

    rng = random.Random(7)
    elencos07 = {t: list(n) for t, n in ELENCOS_6.items()}
    p07 = gerar_torneio(rng, elencos07, 57031, date(2026, 10, 3), vencedor_por_ranking(ranking))
    for p in p07:
        if p["rodada"] == 4:
            for j in p["jogadores"]:
                if j["time"] == "Ursos" and j["nick"] == "Pardo":
                    j["nick"] = "Garra"
    salvar_csv("07-jogador-em-dois-times.csv", para_linhas(p07))
    registrar_no_site(p07)
    resumo["07"] = salvar_esperado("07-jogador-em-dois-times", p07)

    rng = random.Random(10)
    elencos_out = {t: list(n) for t, n in ELENCOS_6.items()}
    ranking_out = ["Leões", "Águias", "Dragões", "Ursos", "Fênix", "Lobos-Guará"]
    p_out = gerar_torneio(rng, elencos_out, 61037, date(2026, 10, 10), vencedor_por_ranking(ranking_out))
    for p in p_out:
        if p["rodada"] == 3:
            for j in list(p["jogadores"]):
                if j["nick"] == "Bico":
                    sub = {**j, "nick": "Sabiá", "minutos": j["minutos"] - 15, "kills": 3}
                    j["minutos"] = 15
                    p["jogadores"].insert(p["jogadores"].index(j) + 1, sub)
    salvar_csv("torneio-outubro.csv", para_linhas(p_out))
    registrar_no_site(p_out)
    resumo["outubro"] = salvar_esperado("torneio-outubro", p_out)

    rng = random.Random(11)
    ranking_nov = ["Ursos", "Dragões", "Leões", "Águias", "Lobos-Guará", "Fênix"]
    p_nov = gerar_torneio(rng, ELENCOS_6, 62041, date(2026, 11, 7), vencedor_por_ranking(ranking_nov))
    instaveis = {p_nov[2]["id"]: {"falhas_antes_de_responder": 2},
                 p_nov[9]["id"]: {"falhas_antes_de_responder": 5}}
    registrar_no_site(p_nov, **instaveis)
    linhas_nov = para_linhas(p_nov)
    for l in linhas_nov:
        if l["Rodada"] == "2" and l["Nick"] == "Mel.zinho":
            l["Nick"] = "mel.zinho"
    dup = next(i for i, l in enumerate(linhas_nov) if l["Rodada"] == "4" and l["Nick"] == "Rapina")
    linhas_nov.insert(dup + 1, dict(linhas_nov[dup]))
    salvar_csv("torneio-novembro.csv", linhas_nov)
    resumo["novembro"] = {"instaveis": instaveis, "classificacao": salvar_esperado("torneio-novembro", p_nov)}

    resumo["setembro"] = salvar_esperado("torneio-setembro", partidas_setembro())

    if not SO_ESPERADO:
        (BASE / "site-oficial.json").write_text(
            json.dumps(site_oficial, ensure_ascii=False, indent=2), encoding="utf-8")
    (BASE / "resumo-geracao.json").write_text(
        json.dumps(resumo, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(json.dumps(resumo, ensure_ascii=False, indent=1, default=str))


if __name__ == "__main__":
    main()
