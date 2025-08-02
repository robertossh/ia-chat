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
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [gerandoImagem, setGerandoImagem] = useState(false);
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
  const gerarPDF = async () => {
    try {
      if (mensagens.length === 0) {
        alert('Não há mensagens para exportar.');
        return;
      }

      setGerandoPDF(true);
      
      // Aguardar um pouco para mostrar o feedback visual
      await new Promise(resolve => setTimeout(resolve, 100));

      const pdf = new jsPDF();
      
      // Cabeçalho
      pdf.setFontSize(18);
      pdf.setFont(undefined, 'bold');
      pdf.text('JSL - Roberto IA', 20, 20);
      
      pdf.setFontSize(12);
      pdf.setFont(undefined, 'normal');
      pdf.text('Conversa Exportada', 20, 30);
      pdf.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 20, 40);
      pdf.text(`Modelo: ${modelos.find(m => m.id === modeloSelecionado)?.nome || 'N/A'}`, 20, 50);
      
      // Linha separadora
      pdf.line(20, 55, 190, 55);
      
      let yPosition = 70;
      
      mensagens.forEach((msg, index) => {
        // Verificar se precisa de nova página
        if (yPosition > 270) {
          pdf.addPage();
          yPosition = 20;
        }
        
        // Remetente
        pdf.setFont(undefined, 'bold');
        pdf.setFontSize(11);
        const remetente = msg.ehUsuario ? 'Usuário' : 'Roberto IA';
        pdf.text(`${remetente}:`, 20, yPosition);
        
        // Timestamp
        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(9);
        const timestamp = new Date(msg.timestamp).toLocaleTimeString('pt-BR');
        pdf.text(timestamp, 160, yPosition);
        
        yPosition += 8;
        
        // Mensagem (quebrar texto se necessário)
        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(10);
        const linhas = pdf.splitTextToSize(msg.texto, 170);
        
        linhas.forEach(linha => {
          if (yPosition > 270) {
            pdf.addPage();
            yPosition = 20;
          }
          pdf.text(linha, 20, yPosition);
          yPosition += 6;
        });
        
        yPosition += 5; // Espaço entre mensagens
      });
      
      // Salvar com nome único
      const dataAtual = new Date().toISOString().slice(0, 10);
      pdf.save(`chat-jsl-${dataAtual}.pdf`);
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar o PDF. Verifique o console para mais detalhes.');
    } finally {
      setGerandoPDF(false);
    }
  };

  // Função para gerar imagem do chat
  const gerarImagemChat = async () => {
    try {
      setGerandoImagem(true);
      
      // Aguardar um pouco para garantir que o elemento esteja renderizado
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const chatElement = document.querySelector('.chat-container');
      if (!chatElement) {
        alert('Erro: Área do chat não encontrada. Tente novamente.');
        return;
      }

      // Configurações do html2canvas para melhor qualidade
      const canvas = await html2canvas(chatElement, {
        backgroundColor: '#ffffff',
        scale: 2, // Maior resolução
        useCORS: true,
        allowTaint: true,
        scrollX: 0,
        scrollY: 0,
        width: chatElement.scrollWidth,
        height: chatElement.scrollHeight
      });

      // Converter para blob e fazer download
      canvas.toBlob((blob) => {
        if (blob) {
          saveAs(blob, `chat-jsl-${new Date().toISOString().slice(0, 10)}.png`);
        } else {
          alert('Erro ao gerar a imagem. Tente novamente.');
        }
      }, 'image/png', 1.0);

    } catch (error) {
      console.error('Erro ao gerar imagem do chat:', error);
      alert('Erro ao gerar a imagem do chat. Verifique o console para mais detalhes.');
    } finally {
      setGerandoImagem(false);
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
    <div className="min-h-screen bg-white relative">
      {/* Header estilo Gemini com cores JSL */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-red-600 to-red-700 rounded-xl flex items-center justify-center shadow-lg">
                <div className="text-white font-bold text-sm">JSL</div>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Roberto IA</h1>
                <p className="text-sm text-red-600">🚛 Entender para Atender</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMostrarConfig(true)}
                className="p-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg shadow-md border border-gray-200 transition-all duration-200"
                title="Configurações"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              
              <button
                   onClick={limparChat}
                   className="p-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg shadow-md border border-gray-200 transition-all duration-200"
                   title="Limpar conversa"
                 >
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16" />
                   </svg>
                 </button>
            </div>
          </div>
        </div>
      </header>

      {/* Container principal */}
      <div className="max-w-4xl mx-auto px-4 py-6 h-screen flex flex-col">
        {/* Seletor de Modelo estilo Gemini */}
        <div className="mb-6">
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
            <div className="flex flex-wrap gap-2">
              {modelos.map((modelo) => (
                <button
                  key={modelo.id}
                  onClick={() => setModeloSelecionado(modelo.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    modeloSelecionado === modelo.id
                      ? "bg-red-600 text-white shadow-lg"
                      : "bg-white text-gray-700 hover:bg-red-50 hover:text-red-600 border border-gray-200"
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

        {/* Chat Container estilo Gemini */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          {/* Messages Area estilo Gemini */}
          <div className="flex-1 overflow-y-auto p-6 chat-container">
            {mensagens.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-red-600 to-red-700 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                  <div className="text-white font-bold text-xl">JSL</div>
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">Olá! Sou o Roberto IA</h3>
                <p className="text-gray-600 mb-8">Como posso ajudar você hoje?</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer">
                    <div className="text-red-600 mb-2">🚛</div>
                    <h4 className="font-medium text-gray-900 mb-1">Logística</h4>
                    <p className="text-sm text-gray-600">Pergunte sobre transporte e logística</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer">
                    <div className="text-red-600 mb-2">📊</div>
                    <h4 className="font-medium text-gray-900 mb-1">Relatórios</h4>
                    <p className="text-sm text-gray-600">Gere documentos e análises</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer">
                    <div className="text-red-600 mb-2">🎤</div>
                    <h4 className="font-medium text-gray-900 mb-1">Voz</h4>
                    <p className="text-sm text-gray-600">Converse por áudio</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer">
                    <div className="text-red-600 mb-2">🖼️</div>
                    <h4 className="font-medium text-gray-900 mb-1">Imagens</h4>
                    <p className="text-sm text-gray-600">Analise e processe imagens</p>
                  </div>
                </div>
              </div>
            )}
            
            {mensagens.map((msg) => (
              <div key={msg.id} className="mb-8">
                <div className={`flex gap-4 ${msg.ehUsuario ? 'justify-end' : 'justify-start'}`}>
                  {!msg.ehUsuario && (
                    <div className="w-8 h-8 bg-gradient-to-r from-red-600 to-red-700 rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="text-white font-bold text-xs">JSL</div>
                    </div>
                  )}
                  
                  <div className={`max-w-[80%] ${msg.ehUsuario ? 'order-first' : ''}`}>
                    <div className={`p-4 rounded-2xl ${
                      msg.ehUsuario 
                        ? 'bg-red-600 text-white ml-auto' 
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      {/* Exibir imagem se houver */}
                      {msg.imagem && (
                        <div className="mb-3">
                          <img 
                            src={msg.imagem} 
                            alt="Imagem enviada" 
                            className="max-w-full h-auto rounded-lg"
                            style={{ maxHeight: '200px' }}
                          />
                        </div>
                      )}
                      
                      <div className="whitespace-pre-wrap leading-relaxed">{msg.conteudo}</div>
                      
                      {/* Indicador de tipo de mídia */}
                      {msg.tipoMidia && msg.tipoMidia !== 'texto' && (
                        <div className={`flex items-center mt-2 text-xs ${msg.ehUsuario ? 'text-red-200' : 'text-gray-500'}`}>
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
                    
                    <div className={`text-xs text-gray-500 mt-1 ${msg.ehUsuario ? 'text-right' : 'text-left'}`}>
                      {msg.timestamp}
                    </div>
                  </div>
                  
                  {msg.ehUsuario && (
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {(carregando || digitando) && (
              <div className="mb-8">
                <div className="flex gap-4 justify-start">
                  <div className="w-8 h-8 bg-gradient-to-r from-red-600 to-red-700 rounded-full flex items-center justify-center flex-shrink-0">
                    <div className="text-white font-bold text-xs">JSL</div>
                  </div>
                  <div className="bg-gray-100 p-4 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                      <span className="text-sm text-gray-600">{digitando ? "Digitando..." : "Pensando..."}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={referenciaFimMensagens} />
          </div>

          {/* Input Area estilo Gemini */}
           <div className="border-t border-gray-200 p-4 bg-white">
             {/* Preview da imagem selecionada */}
             {imagemSelecionada && (
               <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl mb-4">
                 <img 
                   src={imagemSelecionada} 
                   alt="Preview" 
                   className="w-12 h-12 object-cover rounded-lg"
                 />
                 <div className="flex-1">
                   <p className="text-sm text-gray-900 font-medium">Imagem selecionada</p>
                   <p className="text-xs text-gray-500">Pronta para envio</p>
                 </div>
                 <button
                   onClick={() => {
                     setImagemSelecionada(null);
                     setTipoMidia('texto');
                   }}
                   className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
                 >
                   <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                   </svg>
                 </button>
               </div>
             )}
             
             {/* Input principal */}
             <div className="flex items-end gap-3">
               {/* Botões de mídia */}
               <div className="flex gap-1">
                 <button
                   onClick={() => fileInputRef.current?.click()}
                   className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                   title="Anexar imagem"
                 >
                   <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                   </svg>
                 </button>
                 
                 <button
                   onClick={gravando ? pararGravacao : iniciarGravacao}
                   className={`p-2 rounded-lg transition-colors ${
                     gravando 
                       ? 'bg-red-100 text-red-600' 
                       : 'hover:bg-gray-100 text-gray-600'
                   }`}
                   title={gravando ? "Parar gravação" : "Gravar áudio"}
                 >
                   {gravando ? (
                     <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                       <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                     </svg>
                   ) : (
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                     </svg>
                   )}
                 </button>
                 
                 {mensagens.length > 0 && (
                   <>
                     <button
                       onClick={gerarPDF}
                       disabled={gerandoPDF}
                       className={`p-2 rounded-lg transition-colors ${
                         gerandoPDF 
                           ? 'bg-red-100 text-red-600 cursor-not-allowed' 
                           : 'hover:bg-gray-100 text-gray-600'
                       }`}
                       title={gerandoPDF ? "Gerando PDF..." : "Exportar como PDF"}
                     >
                       {gerandoPDF ? (
                         <div className="w-5 h-5 border-2 border-red-600/30 border-t-red-600 rounded-full animate-spin"></div>
                       ) : (
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                         </svg>
                       )}
                     </button>
                     
                     <button
                       onClick={gerarImagemChat}
                       disabled={gerandoImagem}
                       className={`p-2 rounded-lg transition-colors ${
                         gerandoImagem 
                           ? 'bg-red-100 text-red-600 cursor-not-allowed' 
                           : 'hover:bg-gray-100 text-gray-600'
                       }`}
                       title={gerandoImagem ? "Gerando imagem..." : "Capturar como imagem"}
                     >
                       {gerandoImagem ? (
                         <div className="w-5 h-5 border-2 border-red-600/30 border-t-red-600 rounded-full animate-spin"></div>
                       ) : (
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                         </svg>
                       )}
                     </button>
                   </>
                 )}
               </div>
               
               {/* Input de texto */}
               <div className="flex-1 relative">
                 <textarea
                   value={valorInput}
                   onChange={(e) => setValorInput(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter' && !e.shiftKey) {
                       e.preventDefault();
                       enviarMensagem();
                     }
                   }}
                   placeholder={gravando ? "Gravando áudio..." : imagemSelecionada ? "Descreva a imagem (opcional)..." : "Digite sua mensagem..."}
                   disabled={carregando || !apiKey || gravando}
                   rows={1}
                   className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 resize-none"
                   style={{ minHeight: '48px', maxHeight: '120px' }}
                   onInput={(e) => {
                     e.target.style.height = 'auto';
                     e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                   }}
                 />
                 
                 {/* Indicador de gravação */}
                 {gravando && (
                   <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                     <div className="flex items-center gap-2">
                       <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                       <span className="text-xs text-red-500">Gravando</span>
                     </div>
                   </div>
                 )}
               </div>
               
               {/* Botão de envio */}
               <button
                   onClick={enviarMensagem}
                   disabled={carregando || (!valorInput.trim() && !imagemSelecionada) || !apiKey || gravando || gerandoPDF || gerandoImagem}
                   className="p-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-full transition-all duration-200 shadow-lg"
                 >
                 {carregando ? (
                   <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                 ) : (
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                   </svg>
                 )}
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
           </div>
        </div>
      </div>
    </div>
  );
}

export default App;
