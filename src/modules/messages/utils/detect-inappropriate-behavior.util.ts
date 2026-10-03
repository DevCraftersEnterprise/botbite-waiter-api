export const detectInappropriateBehaviorUtil = (message: string): boolean => {
  const lowerMessage = message.toLowerCase().trim();

  const inappropriateWords = [
    'hola mundo',
    'hello world',
    'test',
    'prueba',
    'pendejo',
    'idiota',
    'estupido',
    'estúpido',
    'tonto',
    'imbecil',
    'imbécil',
    'chinga',
    'pinche',
    'cabrón',
    'cabron',
    'puto',
    'puta',
    'verga',
    'culero',
    'mamada',
    'mamadas',
    'joder',
    'coño',
    'mierda',
    'cagada',
    'fuck',
    'shit',
    'bitch',
    'asshole',
    'damn',
    'stupid',
    'idiot',
    'lorem ipsum',
    'asdf',
    'qwerty',
    '123abc',
    'testing',
  ];

  const hasInappropriateWords = inappropriateWords.some((word) =>
    lowerMessage.includes(word),
  );

  return hasInappropriateWords;
};
