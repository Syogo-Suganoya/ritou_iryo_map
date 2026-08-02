#!/usr/bin/env python3
"""アーキテクチャ図を docs/ 配下に生成する。

    /Library/Developer/CommandLineTools/usr/bin/python3 scripts/architecture.py

依存: diagrams (pip), graphviz (brew install graphviz)
出力: docs/architecture.png（実行時構成）/ docs/data-pipeline.png（データ取り込みとCD）
"""

import os

from diagrams import Cluster, Diagram, Edge
from diagrams.onprem.ci import GithubActions
from diagrams.onprem.client import Users
from diagrams.onprem.container import Docker
from diagrams.onprem.database import PostgreSQL
from diagrams.onprem.network import Internet
from diagrams.onprem.vcs import Github
from diagrams.programming.framework import NextJs, React
from diagrams.programming.language import Nodejs
from diagrams.saas.cdn import Cloudflare

# 日本語ラベルが豆腐にならないようフォントを明示する
FONT = "Hiragino Sans"
GRAPH_ATTR = {
    "fontname": FONT,
    "fontsize": "18",
    "labelloc": "t",
    "pad": "0.4",
    "splines": "spline",
}
NODE_ATTR = {"fontname": FONT, "fontsize": "11"}
EDGE_ATTR = {"fontname": FONT, "fontsize": "10"}

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs")


def runtime_architecture() -> None:
    """本番実行時の構成。外部通信は地図タイルとグリフだけであることを示す。"""
    with Diagram(
        "島しょ・へき地医療アクセス可視化マップ / 実行時構成",
        filename=os.path.join(OUT_DIR, "architecture"),
        outformat="png",
        show=False,
        direction="LR",
        graph_attr=GRAPH_ATTR,
        node_attr=NODE_ATTR,
        edge_attr=EDGE_ATTR,
    ):
        visitor = Users("閲覧者")

        with Cluster("Cloudflare Workers", graph_attr={"fontname": FONT}):
            app = NextJs("Next.js (App Router)\n@opennextjs/cloudflare")
            with Cluster("画面", graph_attr={"fontname": FONT}):
                workbench = React("/ ワークブック\n地図・人口対比・優先エリア")
                island = React("/island/[slug]\n島別詳細")
            with Cluster("API Route", graph_attr={"fontname": FONT}):
                api_islands = Nodejs("/api/islands\narea_gap ビュー")
                api_facilities = Nodejs("/api/facilities\nfacilities JOIN areas")
            hyperdrive = Cloudflare("Hyperdrive\n(TCPプロキシ/プーリング)")

        neon = PostgreSQL("Neon PostgreSQL\nareas / facilities / area_gap")
        tiles = Internet("国土地理院タイル\nglyphs.geolonia.com")

        visitor >> Edge(label="HTTPS") >> app
        app >> Edge(style="dashed") >> [workbench, island]
        workbench >> api_islands
        island >> api_facilities
        [api_islands, api_facilities] >> Edge(label="pg (SQL)") >> hyperdrive
        hyperdrive >> Edge(label="TLS / 直接接続") >> neon
        workbench >> Edge(label="地図画像・島名グリフ", style="dotted", color="darkgreen") >> tiles


def data_pipeline() -> None:
    """データ取り込み（事前バッチ）とデプロイ経路。アプリ実行中はAPIを叩かない。"""
    with Diagram(
        "データ取り込みパイプライン と CI/CD",
        filename=os.path.join(OUT_DIR, "data-pipeline"),
        outformat="png",
        show=False,
        direction="LR",
        graph_attr=GRAPH_ATTR,
        node_attr=NODE_ATTR,
        edge_attr=EDGE_ATTR,
    ):
        with Cluster("東京都オープンデータAPI", graph_attr={"fontname": FONT}):
            pop = Internet("人口（推計）")
            emg = Internet("救急医療機関一覧")
            clinic = Internet("診療・検査医療機関一覧")
        gsi = Internet("国土地理院\nジオコーディング")

        with Cluster("ローカル（事前バッチ）", graph_attr={"fontname": FONT}):
            ingest = Nodejs("npm run ingest\nscripts/ingest.mjs\n名寄せ・表記ゆれ吸収")
            seed = PostgreSQL("db/init/02_seed.sql\n（生成物・コミット対象）")
            local_db = Docker("Docker PostgreSQL\nlocalhost:5436")

        with Cluster("CI/CD", graph_attr={"fontname": FONT}):
            repo = Github("GitHub\nmain ブランチ")
            actions = GithubActions("Actions\nlint → tsc → deploy")

        worker = Cloudflare("Cloudflare Workers\nritou-iryo-map")
        neon = PostgreSQL("Neon PostgreSQL")

        [pop, emg, clinic] >> Edge(label="offsetページング") >> ingest
        ingest >> Edge(label="住所→緯度経度\n(.geocache.json)", style="dashed") >> gsi
        ingest >> seed
        seed >> Edge(label="docker compose up") >> local_db
        seed >> Edge(label="SQL Editorで手動投入", style="dashed") >> neon

        repo >> Edge(label="push") >> actions
        actions >> Edge(label="opennextjs-cloudflare deploy") >> worker
        worker >> Edge(label="Hyperdrive経由") >> neon


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    runtime_architecture()
    data_pipeline()
    print(f"generated: {OUT_DIR}/architecture.png, {OUT_DIR}/data-pipeline.png")
