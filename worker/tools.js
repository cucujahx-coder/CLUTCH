/* Описания инструментов для модели. Исполняет их браузер, а не сервер: изменения идут
   теми же функциями, что и кнопки интерфейса, поэтому сохранение, анимации и тесты
   работают без изменений, а сервер не может ничего испортить в задачах.

   Список уходит в поле tools и попадает в кэшируемый префикс вместе с правилами —
   значит между запросами он меняться не должен. Источник правды — PROMPT.md. */

const str=(d)=>({type:'string',description:d});

export const TOOLS=[
 {name:'task_rename',description:'Переименовать текущую запись.',
  input_schema:{type:'object',properties:{title:str('Новое название')},required:['title'],additionalProperties:false}},

 {name:'task_set_due',description:'Поставить или снять срок текущей записи. Дату бери только из календаря в промте.',
  input_schema:{type:'object',properties:{date:{type:['string','null'],description:'YYYY-MM-DD или null, чтобы снять срок'}},required:['date'],additionalProperties:false}},

 {name:'task_complete',description:'Закрыть текущую задачу или вернуть её в работу.',
  input_schema:{type:'object',properties:{done:{type:'boolean',description:'true — закрыть, false — вернуть'}},required:['done'],additionalProperties:false}},

 {name:'task_set_tail',description:'Обновить короткую подпись под названием в списке. 2–4 слова, строчными, без точки. Только когда изменилось состояние дела.',
  input_schema:{type:'object',properties:{tail:str('Например: черновик письма, жду счёт, выбрали клинику')},required:['tail'],additionalProperties:false}},

 {name:'task_make_project',description:'Сделать текущую задачу проектом и завести шаги. Само название задачи станет первым шагом.',
  input_schema:{type:'object',properties:{steps:{type:'array',items:{type:'string'},description:'Названия шагов по порядку'}},required:['steps'],additionalProperties:false}},

 {name:'task_add_step',description:'Добавить шаг в текущий проект.',
  input_schema:{type:'object',properties:{title:str('Название шага'),after:str('Идентификатор шага, после которого вставить; без него — в конец')},required:['title'],additionalProperties:false}},

 {name:'task_complete_step',description:'Закрыть шаг проекта или открыть обратно.',
  input_schema:{type:'object',properties:{step:str('Идентификатор шага, например s2'),done:{type:'boolean'}},required:['step','done'],additionalProperties:false}},

 {name:'task_delete_step',description:'Удалить шаг проекта. Только после подтверждения пользователя.',
  input_schema:{type:'object',properties:{step:str('Идентификатор шага')},required:['step'],additionalProperties:false}},

 {name:'task_create',description:'Создать другую задачу.',
  input_schema:{type:'object',properties:{title:str('Название'),due:{type:['string','null'],description:'YYYY-MM-DD или null'},steps:{type:'array',items:{type:'string'},description:'Если задача сразу проект'}},required:['title'],additionalProperties:false}},

 {name:'task_delete',description:'Переместить запись в корзину. Только после подтверждения пользователя.',
  input_schema:{type:'object',properties:{id:str('Идентификатор записи, например t12 или p8')},required:['id'],additionalProperties:false}},

 {name:'task_search',description:'Найти записи по названиям и подписям. Возвращает идентификаторы.',
  input_schema:{type:'object',properties:{query:str('Что искать'),scope:{type:'string',enum:['open','done','all'],description:'По умолчанию open'}},required:['query'],additionalProperties:false}},

 {name:'chat_search',description:'Найти упоминание в прошлых переписках по всем задачам.',
  input_schema:{type:'object',properties:{query:str('Что искать')},required:['query'],additionalProperties:false}},

 {name:'file_write',description:'Сохранить текст файлом во вложения текущей записи. Существующий файл не перезаписывай без подтверждения пользователя.',
  input_schema:{type:'object',properties:{
   name:str('Имя с расширением, например pismo-marine.md'),
   mime:str('Тип содержимого, например text/markdown или text/csv'),
   content:str('Содержимое файла'),
   overwrite:{type:'boolean',description:'Перезаписать существующий файл'}
  },required:['name','content'],additionalProperties:false}},

 {name:'file_read',description:'Прочитать сохранённый файл текущей записи по имени. Маленькие файлы уже вложены в снимок — их читать не нужно.',
  input_schema:{type:'object',properties:{name:str('Имя файла')},required:['name'],additionalProperties:false}}
];

/* Чтение не считается в лимит действий: иначе разведка съедает бюджет на изменения */
export const READ=new Set(['task_search','chat_search','file_read']);
