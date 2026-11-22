-- 랭킹 내 기록 헬멧 고치기 (v1.8.7-d1). Supabase SQL Editor에 붙여 넣고 Run, 한 번만.
-- 게임이 폰에 있는 삭제 열쇠(del_hash의 원래 값)를 보내면, 그 줄의 helmet 칸만 바꾼다.
create or replace function public.rk_helmet(p_cid text, p_key text, p_helmet jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if jsonb_typeof(p_helmet) <> 'object' or length(p_helmet::text) > 6000 then return 0; end if;
  update ranking set helmet = p_helmet
   where cid::text = p_cid and del_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex');
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.rk_helmet(text, text, jsonb) to anon;
