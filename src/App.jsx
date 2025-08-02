import { useState, useEffect, useRef } from "react";
import axios from "axios";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

function App() {
  const [mensagens, setMensagens] = useState([]);
  const [valorInput, setValorInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [modeloSelecionado, setModeloSelecionado] = useState("anthropic/claude-3.5-sonnet");
  const [digitando, setDigitando] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [imagemSelecionada, setImagemSelecionada] = useState(null);
  const [tipoMidia, setTipoMidia] = useState('texto'); // texto, voz, imagem
  const referenciaFimMensagens = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);

  // Modelos disponíveis no OpenRouter
  const modelos = [
    { id: "anthropic/claude-3.5-sonnet", nome: "Claude 3.5 Sonnet", empresa: "Anthropic" },
    { id: "openai/gpt-4o", nome: "GPT-4o", empresa: "OpenAI" },
    { id: "openai/gpt-4o-mini", nome: "GPT-4o Mini", empresa: "OpenAI" },
    { id: "google/gemini-pro-1.5", nome: "Gemini Pro 1.5", empresa: "Google" },
    { id: "meta-llama/llama-3.1-8b-instruct", nome: "Llama 3.1 8B", empresa: "Meta" },
    { id: "meta-llama/llama-3.1-70b-instruct", nome: "Llama 3.1 70B", empresa: "Meta" },
    { id: "mistralai/mistral-7b-instruct", nome: "Mistral 7B", empresa: "Mistral AI" },
    { id: "cohere/command-r-plus", nome: "Command R+", empresa: "Cohere" }
  ];

  const rolarParaBaixo = () => {
    referenciaFimMensagens.current?.scrollIntoView({
      behavior: "smooth",
    });
  };

  useEffect(rolarParaBaixo, [mensagens]);

  // Carregar API key do localStorage
  useEffect(() => {
    const savedApiKey = localStorage.getItem("openrouter_api_key");
    if (savedApiKey) {
      setApiKey(savedApiKey);
    } else {
      setMostrarConfig(true);
    }
  }, []);

  const salvarApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem("openrouter_api_key", apiKey.trim());
      setMostrarConfig(false);
    }
  };

  const adicionarMensagens = (msg, ehUsuario, modelo = null) => {
    const novaMensagem = { 
      conteudo: msg, 
      ehUsuario, 
      id: Date.now() + Math.random(),
      modelo: modelo,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setMensagens((antigas) => [...antigas, novaMensagem]);
  };

  const simularDigitacao = async () => {
    setDigitando(true);
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
    setDigitando(false);
  };

  const enviarMensagem = async () => {
    const mensagem = valorInput.trim();
    if ((!mensagem && !imagemSelecionada) || !apiKey) return;

    const novaMensagem = {
      conteudo: mensagem || 'Imagem enviada',
      ehUsuario: true,
      id: Date.now() + Math.random(),
      timestamp: new Date().toLocaleTimeString(),
      imagem: imagemSelecionada,
      tipoMidia: tipoMidia
    };
    
    setMensagens((antigas) => [...antigas, novaMensagem]);
    setValorInput("");
    setImagemSelecionada(null);
    setTipoMidia('texto');
    setCarregando(true);

    try {
      await simularDigitacao();

      let mensagemParaIA = mensagem;
      
      // Se há imagem, adicionar contexto
      if (imagemSelecionada) {
        mensagemParaIA = `${mensagem || 'Analise esta imagem'} [Imagem anexada - funcionalidade de análise de imagem será implementada com modelos que suportam visão]`;
      }

      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: modeloSelecionado,
          messages: [
            {
              role: "system",
              content: "Você é um assistente da JSL (Julio Simões Logística), uma empresa brasileira de logística e transporte. Seja prestativo, profissional e responda em português brasileiro. Use emojis quando apropriado para tornar a conversa mais amigável. Você pode gerar documentos, analisar imagens e criar conteúdo visual quando solicitado."
            },
            {
              role: "user",
              content: mensagemParaIA
            }
          ],
          max_tokens: 1000,
          temperature: 0.7
        },
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.origin,
            "X-Title": "Roberto IA Chat"
          }
        }
      );

      const respostaTexto = response.data.choices[0].message.content;
      const modeloAtual = modelos.find(m => m.id === modeloSelecionado);
      
      adicionarMensagens(respostaTexto, false, modeloAtual);
    } catch (erro) {
      console.error("Erro ao comunicar com OpenRouter:", erro);
      let mensagemErro = "Desculpe, ocorreu um erro ao processar sua mensagem.";
      
      if (erro.response?.status === 401) {
        mensagemErro = "Erro de autenticação. Verifique sua API key.";
      } else if (erro.response?.status === 429) {
        mensagemErro = "Limite de requisições atingido. Tente novamente em alguns minutos.";
      }
      
      adicionarMensagens(mensagemErro, false);
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

  const limparChat = () => {
    setMensagens([]);
  };

  // Função para iniciar gravação de voz
  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        processarAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setGravando(true);
    } catch (error) {
      console.error('Erro ao acessar microfone:', error);
      alert('Erro ao acessar o microfone. Verifique as permissões.');
    }
  };

  // Função para parar gravação
  const pararGravacao = () => {
    if (mediaRecorderRef.current && gravando) {
      mediaRecorderRef.current.stop();
      setGravando(false);
    }
  };

  // Função para processar áudio (simulação - em produção usaria speech-to-text)
  const processarAudio = (audioBlob) => {
    // Simulação de conversão de voz para texto
    const textoSimulado = "Texto convertido da gravação de voz (funcionalidade simulada)";
    setValorInput(textoSimulado);
    setTipoMidia('texto');
  };

  // Função para processar imagem
  const processarImagem = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagemSelecionada(e.target.result);
      setTipoMidia('imagem');
    };
    reader.readAsDataURL(file);
  };

  // Função para gerar PDF
  const gerarPDF = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.text('Chat JSL - Conversa Exportada', 20, 20);
    
    let yPosition = 40;
    mensagens.forEach((msg, index) => {
      if (yPosition > 270) {
        pdf.addPage();
        yPosition = 20;
      }
      
      pdf.setFontSize(12);
      pdf.text(`${msg.tipo === 'usuario' ? 'Usuário' : 'IA'}: ${msg.texto}`, 20, yPosition);
      yPosition += 10;
    });
    
    pdf.save('chat-jsl.pdf');
  };

  // Função para gerar imagem do chat
  const gerarImagemChat = async () => {
    const chatElement = document.querySelector('.chat-container');
    if (chatElement) {
      const canvas = await html2canvas(chatElement);
      canvas.toBlob((blob) => {
        saveAs(blob, 'chat-jsl.png');
      });
    }
  };

  const obterCorModelo = (empresa) => {
    const cores = {
      "Anthropic": "from-orange-500 to-red-500",
      "OpenAI": "from-green-500 to-emerald-500",
      "Google": "from-blue-500 to-indigo-500",
      "Meta": "from-purple-500 to-pink-500",
      "Mistral AI": "from-yellow-500 to-orange-500",
      "Cohere": "from-cyan-500 to-blue-500"
    };
    return cores[empresa] || "from-gray-500 to-gray-600";
  };

  if (mostrarConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-black/40 backdrop-blur-xl border border-red-500/20 rounded-3xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-r from-red-600 to-red-700 rounded-2xl flex items-center justify-center mx-auto mb-4 border-2 border-white/20">
              <div className="text-white font-bold text-2xl">JSL</div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Configuração JSL</h1>
            <p className="text-gray-200">Configure sua API key do OpenRouter</p>
            <p className="text-sm text-orange-300 mt-2">🚛 Entender para Atender</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                API Key do OpenRouter
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full px-4 py-3 bg-black/30 border border-red-500/30 rounded-xl text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
              <p className="text-sm text-orange-300">
                <strong>Como obter sua API key:</strong><br/>
                1. Acesse <a href="https://openrouter.ai" target="_blank" className="underline text-orange-200">openrouter.ai</a><br/>
                2. Faça login ou crie uma conta<br/>
                3. Vá em "Keys" e crie uma nova API key
              </p>
            </div>
            
            <button
              onClick={salvarApiKey}
              disabled={!apiKey.trim()}
              className="w-full px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/25"
            >
              Salvar e Continuar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900 relative overflow-hidden">
      {/* Efeitos de fundo animados com cores JSL */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gray-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gray-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gray-600/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4 gap-6">
        {/* Header com identidade JSL */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="w-20 h-20 bg-gradient-to-r from-red-600 to-red-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-red-500/50 border-2 border-white/20">
              <div className="text-white font-bold text-2xl">JSL</div>
            </div>
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-red-400 via-orange-400 to-red-300 bg-clip-text text-transparent">
            Roberto IA Chat
          </h1>
          
          <p className="text-lg text-gray-200 font-light">
            Powered by <span className="text-red-400 font-semibold">JSL Julio Simões Logística</span>
          </p>
          
          <div className="text-sm text-orange-300 font-medium">
            🚛 Entender para Atender • OpenRouter AI
          </div>
        </div>

        {/* Seletor de Modelo com cores JSL */}
        <div className="w-full max-w-4xl mb-4">
          <div className="bg-black/30 backdrop-blur-xl border border-red-500/20 rounded-2xl p-4">
            <div className="flex flex-wrap gap-2">
              {modelos.map((modelo) => (
                <button
                  key={modelo.id}
                  onClick={() => setModeloSelecionado(modelo.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    modeloSelecionado === modelo.id
                      ? "bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-500/30"
                      : "bg-white/10 text-gray-200 hover:bg-red-500/20 hover:text-white border border-red-500/30"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <span className="font-semibold">{modelo.nome}</span>
                    <span className="text-xs opacity-75">{modelo.empresa}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Container com identidade JSL */}
        <div className="w-full max-w-4xl bg-black/30 backdrop-blur-xl border border-red-500/20 rounded-3xl p-6 shadow-2xl shadow-red-900/20">
          {/* Chat Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-red-500/20">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <div className="w-3 h-3 bg-white rounded-full"></div>
              <span className="ml-4 text-sm text-gray-200">
                Modelo: {modelos.find(m => m.id === modeloSelecionado)?.nome}
              </span>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setMostrarConfig(true)}
                className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-lg transition-all duration-200 text-sm font-medium border border-orange-500/30"
              >
                ⚙️ Config
              </button>
              <button
                onClick={limparChat}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all duration-200 text-sm font-medium border border-red-500/30"
              >
                🗑️ Limpar
              </button>
            </div>
          </div>

          {/* Messages Area com cores JSL */}
          <div className="h-96 overflow-y-auto mb-6 p-4 bg-black/30 rounded-2xl border border-red-500/10 chat-container">
            {mensagens.length === 0 && (
              <div className="text-center text-gray-200 mt-20">
                <div className="w-16 h-16 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                  </svg>
                </div>
                <p className="text-lg font-medium">Olá! Escolha um modelo de IA e comece a conversar!</p>
                <p className="text-sm mt-2 text-orange-300">Experimente diferentes modelos para comparar as respostas</p>
              </div>
            )}

            {mensagens.map((msg, index) => (
              <div
                key={msg.id}
                className={`flex mb-4 ${msg.ehUsuario ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl break-words ${
                  msg.ehUsuario
                    ? "bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-500/25"
                    : "bg-gradient-to-r from-orange-600 to-orange-700 text-white shadow-lg shadow-orange-500/25"
                }`}>
                  {!msg.ehUsuario && msg.modelo && (
                    <div className="flex items-center gap-2 mb-2 text-xs text-white/80">
                      <div className="w-2 h-2 bg-white/60 rounded-full"></div>
                      {msg.modelo.nome} • {msg.timestamp}
                    </div>
                  )}
                  {msg.ehUsuario && (
                    <div className="flex items-center gap-2 mb-2 text-xs text-white/80">
                      <div className="w-2 h-2 bg-white/60 rounded-full"></div>
                      Você • {msg.timestamp}
                    </div>
                  )}
                  
                  {/* Exibir imagem se houver */}
                  {msg.imagem && (
                    <div className="mb-2">
                      <img 
                        src={msg.imagem} 
                        alt="Imagem enviada" 
                        className="max-w-full h-auto rounded-lg border border-white/20"
                        style={{ maxHeight: '200px' }}
                      />
                    </div>
                  )}
                  
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.conteudo}</div>
                  
                  {/* Indicador de tipo de mídia */}
                  {msg.tipoMidia && msg.tipoMidia !== 'texto' && (
                    <div className="flex items-center mt-2 text-xs opacity-75">
                      {msg.tipoMidia === 'voz' && (
                        <>
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                          </svg>
                          Mensagem de voz
                        </>
                      )}
                      {msg.tipoMidia === 'imagem' && (
                        <>
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                          </svg>
                          Imagem anexada
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {(carregando || digitando) && (
              <div className="flex justify-start mb-4">
                <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white px-4 py-3 rounded-2xl shadow-lg shadow-orange-500/25">
                  <div className="flex items-center gap-2 mb-2 text-xs text-white/80">
                    <div className="w-2 h-2 bg-white/60 rounded-full"></div>
                    {modelos.find(m => m.id === modeloSelecionado)?.nome}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce delay-100"></div>
                      <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce delay-200"></div>
                    </div>
                    <span className="text-sm">{digitando ? "Digitando..." : "Pensando..."}</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={referenciaFimMensagens}></div>
          </div>

          {/* Input Area com controles de mídia */}
          <div className="space-y-4">
            {/* Controles de mídia */}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setTipoMidia('texto')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  tipoMidia === 'texto'
                    ? "bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-500/30"
                    : "bg-white/10 text-gray-200 hover:bg-red-500/20 hover:text-white border border-red-500/30"
                }`}
              >
                📝 Texto
              </button>
              
              <button
                onClick={gravando ? pararGravacao : iniciarGravacao}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  tipoMidia === 'voz' || gravando
                    ? "bg-gradient-to-r from-orange-600 to-orange-700 text-white shadow-lg shadow-orange-500/30"
                    : "bg-white/10 text-gray-200 hover:bg-orange-500/20 hover:text-white border border-orange-500/30"
                }`}
              >
                {gravando ? '⏹️ Parar' : '🎤 Voz'}
              </button>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  tipoMidia === 'imagem'
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30"
                    : "bg-white/10 text-gray-200 hover:bg-blue-500/20 hover:text-white border border-blue-500/30"
                }`}
              >
                🖼️ Imagem
              </button>
              
              <button
                onClick={gerarPDF}
                disabled={mensagens.length === 0}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 bg-white/10 text-gray-200 hover:bg-green-500/20 hover:text-white border border-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                📄 PDF
              </button>
              
              <button
                onClick={gerarImagemChat}
                disabled={mensagens.length === 0}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 bg-white/10 text-gray-200 hover:bg-purple-500/20 hover:text-white border border-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                📸 Captura
              </button>
            </div>
            
            {/* Input oculto para upload de arquivo */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  processarImagem(file);
                }
              }}
              className="hidden"
            />
            
            {/* Preview da imagem selecionada */}
            {imagemSelecionada && (
              <div className="flex items-center gap-3 p-3 bg-black/30 border border-blue-500/30 rounded-xl">
                <img 
                  src={imagemSelecionada} 
                  alt="Preview" 
                  className="w-16 h-16 object-cover rounded-lg border border-white/20"
                />
                <div className="flex-1">
                  <p className="text-sm text-white font-medium">Imagem selecionada</p>
                  <p className="text-xs text-gray-300">Pronta para envio</p>
                </div>
                <button
                  onClick={() => {
                    setImagemSelecionada(null);
                    setTipoMidia('texto');
                  }}
                  className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all duration-200 text-sm"
                >
                  ❌ Remover
                </button>
              </div>
            )}
            
            {/* Área de input principal */}
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={valorInput}
                  onChange={(e) => setValorInput(e.target.value)}
                  onKeyDown={aoPressionarTecla}
                  placeholder={gravando ? "Gravando áudio..." : imagemSelecionada ? "Descreva a imagem (opcional)..." : "Digite sua mensagem..."}
                  disabled={carregando || !apiKey || gravando}
                  className="w-full px-6 py-4 bg-black/30 border border-red-500/30 rounded-2xl text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 backdrop-blur-sm"
                />
                
                {/* Indicador de gravação */}
                {gravando && (
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-red-400">Gravando...</span>
                    </div>
                  </div>
                )}
              </div>
              
              <button
                onClick={enviarMensagem}
                disabled={carregando || (!valorInput.trim() && !imagemSelecionada) || !apiKey || gravando}
                className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/25 hover:shadow-red-500/40"
              >
                {carregando ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Enviando</span>
                  </div>
                ) : (
                  <span>Enviar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
