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
from diagrams.programming.framework import NextJs
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
    """本番実行時の構成。技術スタックが分かる粒度に絞る（画面・APIの内訳は出さない）。"""
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
            app = NextJs("Next.js (App Router)")
            hyperdrive = Cloudflare("Hyperdrive")

        neon = PostgreSQL("Neon PostgreSQL")
        tiles = Internet("国土地理院タイル")

        visitor >> Edge(label="HTTPS") >> app
        app >> Edge(label="pg (SQL)") >> hyperdrive >> Edge(label="TLS") >> neon
        app >> Edge(label="地図画像", style="dotted", color="darkgreen") >> tiles


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
        tokyo = Internet("東京都オープンデータAPI")
        gsi = Internet("国土地理院\nジオコーディング")

        with Cluster("事前バッチ（ローカル）", graph_attr={"fontname": FONT}):
            ingest = Nodejs("npm run ingest")
            seed = PostgreSQL("02_seed.sql")
            local_db = Docker("Docker PostgreSQL")

        with Cluster("CI/CD", graph_attr={"fontname": FONT}):
            repo = Github("GitHub")
            actions = GithubActions("GitHub Actions")

        worker = Cloudflare("Cloudflare Workers")
        neon = PostgreSQL("Neon PostgreSQL")

        tokyo >> ingest
        gsi >> Edge(style="dashed") >> ingest
        ingest >> seed
        seed >> Edge(label="開発") >> local_db
        seed >> Edge(label="本番へ投入", style="dashed") >> neon

        repo >> Edge(label="push") >> actions >> Edge(label="deploy") >> worker
        worker >> neon


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    runtime_architecture()
    data_pipeline()
    print(f"generated: {OUT_DIR}/architecture.png, {OUT_DIR}/data-pipeline.png")
