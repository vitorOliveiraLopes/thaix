\set ON_ERROR_STOP 0
-- Linhas marcadas "deve falhar" precisam mostrar ERROR.
grant select on all tables in schema public to authenticated;
\set u '11111111-1111-1111-1111-111111111111'
insert into auth.users values (:'u');
insert into skill_exercises(id, skill_id, exercise_name, category, level, sets, reps, time_sec) values
 ('00000000-0000-0000-0000-00000000000a','pull-up','Negativa','skill','iniciante',3,5,null),
 ('00000000-0000-0000-0000-00000000000b','pull-up','Pausa','skill','intermediario',3,5,null),
 ('00000000-0000-0000-0000-00000000000c','pull-up','Hollow','core','iniciante',3,null,30),
 ('00000000-0000-0000-0000-00000000000d','pull-up','Peso','skill','avancado',3,3,null),
 ('00000000-0000-0000-0000-00000000000e','t2b','Knee raise','skill','iniciante',3,8,null);
insert into user_skill_progress values (:'u','pull-up','intermediario',3,1,now(),now()), (:'u','t2b','iniciante',1,0,now(),now());
insert into onboarding_responses values (:'u','{pull-up,t2b}','pull-up');
insert into daily_workouts(id,user_id,skill_id,date,week_number) values ('22222222-2222-2222-2222-222222222222',:'u','pull-up',(now() at time zone 'America/Sao_Paulo')::date,3);
insert into daily_workout_items values ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-00000000000b',1,3,5,null),('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-00000000000c',2,3,null,30);
select set_config('test.uid', :'u', false);

\echo '--- add ok (nível abaixo)'
select coach_apply_workout_ops('22222222-2222-2222-2222-222222222222','[{"type":"add","skill_exercise_id":"00000000-0000-0000-0000-00000000000a"}]');
\echo '--- add acima do nível (deve falhar)'
select coach_apply_workout_ops('22222222-2222-2222-2222-222222222222','[{"type":"add","skill_exercise_id":"00000000-0000-0000-0000-00000000000d"}]');
\echo '--- add outra skill (deve falhar)'
select coach_apply_workout_ops('22222222-2222-2222-2222-222222222222','[{"type":"add","skill_exercise_id":"00000000-0000-0000-0000-00000000000e"}]');
\echo '--- add repetido (deve falhar)'
select coach_apply_workout_ops('22222222-2222-2222-2222-222222222222','[{"type":"add","skill_exercise_id":"00000000-0000-0000-0000-00000000000a"}]');
\echo '--- set_target ok'
select coach_apply_workout_ops('22222222-2222-2222-2222-222222222222','[{"type":"set_target","order_index":1,"sets":5,"reps":8,"time_sec":null}]');
\echo '--- set_target trocando tipo (deve falhar)'
select coach_apply_workout_ops('22222222-2222-2222-2222-222222222222','[{"type":"set_target","order_index":2,"sets":3,"reps":10,"time_sec":null}]');
\echo '--- set_target fora do limite (deve falhar)'
select coach_apply_workout_ops('22222222-2222-2222-2222-222222222222','[{"type":"set_target","order_index":1,"sets":9,"reps":8,"time_sec":null}]');
select order_index, skill_exercise_id, sets, reps, time_sec from daily_workout_items order by order_index;
select adjusted from daily_workouts;
\echo '--- outro usuário (deve falhar)'
select set_config('test.uid', '99999999-9999-9999-9999-999999999999', false);
select coach_apply_workout_ops('22222222-2222-2222-2222-222222222222','[{"type":"remove","order_index":1}]');
select coach_manage_skill('pull-up','remove');
select set_config('test.uid', :'u', false);

\echo '--- level_down'
select coach_manage_skill('pull-up','level_down');
select skill_id, level, sessions_at_current_level from user_skill_progress order by 1;
select count(*) as treinos_pendentes_pullup from daily_workouts where skill_id='pull-up';
select * from skill_level_history;
\echo '--- level_down no primeiro nível (deve falhar)'
select coach_manage_skill('t2b','level_down');
\echo '--- remove'
select coach_manage_skill('pull-up','remove');
select skill_id from user_skill_progress;
select skill_id, level, week_number from user_skill_paused;
select focus_skill_id from onboarding_responses;
\echo '--- remove última skill (deve falhar)'
select coach_manage_skill('t2b','remove');
\echo '--- skill inexistente (deve falhar)'
select coach_manage_skill('hspu','remove');
\echo '--- add com reps fora do limite (deve falhar)'
insert into daily_workouts(id,user_id,skill_id,date,week_number) values ('33333333-3333-3333-3333-333333333333',:'u','t2b',(now() at time zone 'America/Sao_Paulo')::date,1);
insert into daily_workout_items values ('33333333-3333-3333-3333-333333333333','00000000-0000-0000-0000-00000000000e',1,3,8,null);
insert into skill_exercises(id, skill_id, exercise_name, category, level, sets, reps, time_sec) values ('00000000-0000-0000-0000-00000000000f','t2b','Tuck','skill','iniciante',3,6,null);
select coach_apply_workout_ops('33333333-3333-3333-3333-333333333333','[{"type":"add","skill_exercise_id":"00000000-0000-0000-0000-00000000000f","reps":0}]');
\echo '--- restore'
select coach_manage_skill('pull-up','restore');
select skill_id, level, week_number from user_skill_progress order by 1;
select count(*) as pausadas from user_skill_paused;
\echo '--- restore sem nível guardado (deve falhar)'
select coach_manage_skill('pull-up','restore');
\echo '--- aluno não grava em user_skill_paused (deve falhar)'
set role authenticated;
insert into user_skill_paused values (:'u','hspu','avancado',20,0,now());
reset role;
