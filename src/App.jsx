import { useState, useEffect, useRef } from "react";

function App() {
  const [mensagens, setMensagens] = useState([]);
  const [valorInput, setValorInput] = useState("");
  const [iaPronta, setIaPronta] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const referenciaFimMensagens = useRef(null);

  useEffect(() => {
    const checarPronto = setInterval(() => {
      if (
        window.puter &&
        window.puter.ai &&
        typeof window.puter.ai.chat === "function"
      ) {
        setIaPronta(true);
        clearInterval(checarPronto);
      }
    }, 300);
    return () => clearInterval(checarPronto);
  }, []);

  const rolarParaBaixo = () => {
    referenciaFimMensagens.current?.scrollIntoView({
      behavior: "smooth",
    });
  };

  useEffect(rolarParaBaixo, [mensagens]);

  const adicionarMensagens = (msg, ehUsuario) => {
    setMensagens((antigas) => [
      ...antigas,
      { conteudo: msg, ehUsuario, id: Date.now() + Math.random() },
    ]);
  };

  const enviarMensagem = async () => {
    const mensagem = valorInput.trim();
    if (!mensagem) return;

    if (!iaPronta) {
      adicionarMensagens(
        "Aguarde, carregando meus serviços... já já vou te ajudar!",
        false
      );
      return;
    }

    adicionarMensagens(mensagem, true);
    setValorInput("");
    setCarregando(true);

    try {
      const resposta = await window.puter.ai.chat(mensagem);

      const respostaTexto =
        typeof resposta === "string"
          ? resposta
          : resposta.message?.content || "nenhuma resposta recebida.";

      adicionarMensagens(respostaTexto, false);
    } catch (erro) {
      adicionarMensagens(
        `Erro: ${erro.message || "algo deu errado."}`,
        false
      );
    } finally {
      setCarregando(false);
    }
  };

  const aoPressionarTecla = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  };

  return (
    <div
      className="
        min-h-screen
        bg-gradient-to-br
        from-sky-900
        via-slate-950
        to-emerald-900
        flex flex-col
        items-center
        justify-center
        p-4
        gap-8
      "
    >
      <h1
        className="
          text-6xl
          sm:text-7xl
          font-light
          bg-gradient-to-r
          from-emerald-400
          via-sky-300
          to-blue-500
          bg-clip-text
          text-transparent
          text-center
          h-20
        "
      >
        Chat IA By Roberto Junior
      </h1>

      <div
        className={`
          px-4
          py-2
          rounded-full
          text-sm
          ${
            iaPronta
              ? "bg-green-500/20 text-green-300 border border-green-500/30"
              : "bg-yellow-500/20 text-yellow-300 border border-yellow-500/20"
          }
        `}
      >
        {iaPronta ? "IA Pronta" : "Aguardando IA..."}
      </div>

      <div
        className="
          w-full
          max-w-2xl
          bg-gradient-to-r
          from-gray-800/90
          to-gray-700/90
          backdrop-blur-md
          border border-gray-600
          rounded-3xl
          p-6
          shadow-2xl
        "
      >
        <div
          className="
            h-80
            overflow-y-auto
            border-b
            border-gray-600
            mb-6
            p-4
            bg-gradient-to-b
            from-gray-900/50
            to-gray-800/50
            rounded-2xl
          "
        >
          {mensagens.length === 0 && (
            <div className="text-center text-gray-400">
              Comece a conversar digitando uma mensagem abaixo.
            </div>
          )}

          {mensagens.map((msg) => (
            <div
              key={msg.id}
              className={`p-3 m-2 rounded-2xl max-w-xs break-words ${
                msg.ehUsuario
                  ? "bg-gradient-to-r from-blue-600 to-emerald-500 text-white ml-auto text-right"
                  : "bg-gradient-to-r from-emerald-600 to-indigo-600 text-white"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.conteudo}</div>
            </div>
          ))}

          {carregando && (
            <div
              className="
                p-3
                m-2
                rounded-2xl
                max-w-xs
                bg-gradient-to-r
                from-emerald-600
                to-indigo-600
                text-white
              "
            >
              <div className="flex items-center gap-2">
                <div
                  className="
                    animate-spin
                    w-4
                    h-4
                    border-2
                    border-white/30
                    border-t-white
                    rounded-full
                  "
                ></div>
                Pensando...
              </div>
            </div>
          )}

          <div ref={referenciaFimMensagens}></div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={valorInput}
            onChange={(e) => setValorInput(e.target.value)}
            onKeyDown={aoPressionarTecla}
            placeholder={iaPronta ? "Digite sua mensagem..." : "Aguardando IA ficar pronta..."}
            disabled={!iaPronta || carregando}
            className="
              flex-1
              px-4
              py-3
              bg-gray-700/80
              border
              border-gray-600
              rounded-2xl
              text-white
              placeholder-gray-400
              focus:outline-none
              focus:ring-2
              focus:shadow-xl
              focus:shadow-sky-400/80
              focus:ring-sky-500
              transition
              duration-400
              disabled:opacity-50
              disabled:cursor-not-allowed
            "
          />
          <button
            onClick={enviarMensagem}
            disabled={!iaPronta || carregando || !valorInput.trim()}
            className="
              px-6
              py-3
              bg-gradient-to-r
              from-sky-400
              to-emerald-400
              hover:opacity-80
              text-white
              font-semibold
              rounded-2xl
              transition
              disabled:opacity-50
              disabled:cursor-not-allowed
            "
          >
            {carregando ? (
              <div className="flex items-center gap-2">
                <div
                  className="
                    animate-spin
                    w-4
                    h-4
                    border-2
                    border-white/30
                    border-t-white
                    rounded-full
                  "
                ></div>
                enviando
              </div>
            ) : (
              "enviar"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
