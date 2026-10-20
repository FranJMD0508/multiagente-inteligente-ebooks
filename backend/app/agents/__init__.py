"""Los cuatro agentes de Folio (RNF-04): Investigador, Redactor, Ejercicios y Maquetador.

Cada agente es un módulo independiente con sus prompts en `app/prompts/<agente>/`.
Los agentes no tocan el store ni emiten eventos: reciben datos y devuelven
resultados. El orquestador (`app/graph`) decide cuándo llamarlos.
"""
