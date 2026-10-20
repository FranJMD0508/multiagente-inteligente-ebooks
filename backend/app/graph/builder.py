"""Construcción del grafo (docs/03 §3).

    START ─(entry)─► guardarrail ─► investigador ─► marcar_indice ─► punto_control_indice ⏸
       "indice" ──────────────────────────────────► marcar_indice
       "cap1"   ──────────────────────────────────► marcar_cap1
       "redactar" ─► redactor        "maquetar" ─► maquetador
    punto_control_indice ─ approve ─► redactor
                         ─ regenerate ─► investigador (modo regenerar) ─► marcar_indice
                         ─ regenerate_item ─► investigador_capitulo ─► marcar_indice
    redactor ─► ejercicios ─► cap. 1 sin aprobar ─► marcar_cap1 ─► punto_control_cap1 ⏸
                          ─► quedan capítulos ─► redactor
                          ─► no quedan ─► maquetador ─► END
    punto_control_cap1 ─ adjust ─► redactor (reescribe el cap. 1) ─► ejercicios ─► marcar_cap1
                       ─ approve ─► guia_estilo ─► redactor
    guardarrail ─ rechazado ─► END

Cada punto de control está partido en dos nodos: `marcar_*` fija el estado y
emite `checkpoint.required` solo si cambia, y `punto_control_*` solo llama a
`interrupt()`. Así, al reanudar (LangGraph vuelve a ejecutar el nodo
interrumpido) no se repite ningún efecto.
"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from .nodes import Nodes
from .state import ENTRY_NODES, GraphState


def build_graph(nodes: Nodes) -> StateGraph:
    graph = StateGraph(GraphState)
    graph.add_node("guardarrail", nodes.guardarrail)
    graph.add_node("investigador", nodes.investigador)
    graph.add_node("investigador_capitulo", nodes.investigador_capitulo)
    graph.add_node("marcar_indice", nodes.marcar_indice)
    graph.add_node("punto_control_indice", nodes.punto_control_indice)
    graph.add_node("redactor", nodes.redactor)
    graph.add_node("ejercicios", nodes.ejercicios)
    graph.add_node("marcar_cap1", nodes.marcar_cap1)
    graph.add_node("punto_control_cap1", nodes.punto_control_cap1)
    graph.add_node("guia_estilo", nodes.guia_estilo)
    graph.add_node("maquetador", nodes.maquetador)

    graph.add_conditional_edges(
        START,
        lambda state: ENTRY_NODES.get(state.get("entry") or "inicio", "guardarrail"),
        list(set(ENTRY_NODES.values())),
    )
    graph.add_conditional_edges("guardarrail", nodes.route_guardrail, {"fin": END, "investigador": "investigador"})
    graph.add_edge("investigador", "marcar_indice")
    graph.add_edge("investigador_capitulo", "marcar_indice")
    graph.add_edge("marcar_indice", "punto_control_indice")
    graph.add_conditional_edges(
        "punto_control_indice",
        nodes.route_indice,
        ["redactor", "investigador", "investigador_capitulo", "marcar_indice"],
    )
    graph.add_edge("redactor", "ejercicios")
    graph.add_conditional_edges(
        "ejercicios",
        nodes.route_after_exercise,
        {"marcar_cap1": "marcar_cap1", "redactor": "redactor", "maquetador": "maquetador", "fin": END},
    )
    graph.add_edge("marcar_cap1", "punto_control_cap1")
    graph.add_conditional_edges("punto_control_cap1", nodes.route_cap1, ["redactor", "guia_estilo", "marcar_cap1"])
    graph.add_edge("guia_estilo", "redactor")
    graph.add_edge("maquetador", END)
    return graph
