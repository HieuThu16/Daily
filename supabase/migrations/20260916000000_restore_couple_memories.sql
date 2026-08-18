-- Khôi phục kỷ niệm của Hiếu & Ý (bị mất do person bị xoá -> cascade / soft delete).
-- Chạy trong SQL Editor của project đích. An toàn khi chạy lại nhiều lần.

-- 0) Xoá người không được kéo theo kỷ niệm nữa (nguyên nhân gốc gây mất dữ liệu).
alter table public.shared_events drop constraint if exists shared_events_person_id_fkey;
alter table public.shared_events
  add constraint shared_events_person_id_fkey
  foreign key (person_id) references public.people(id) on delete set null;

-- 1) Khôi phục kỷ niệm bị xoá mềm + gán lại mã phòng.
update public.shared_events se
set deleted_at = null
where se.deleted_at is not null
  and se.owner_id in (
    select id from auth.users
    where lower(trim(email)) ilike 'truongnguyenminhhieu%'
       or lower(trim(email)) = 'nguyenkimy1302.gr@gmail.com'
  );

update public.shared_events se
set room_code = 'HIEU-Y-2026'
where se.room_code is null
  and se.owner_id in (
    select id from auth.users
    where lower(trim(email)) ilike 'truongnguyenminhhieu%'
       or lower(trim(email)) = 'nguyenkimy1302.gr@gmail.com'
  );

-- 2) Đảm bảo có người "vợ" (partner) của Hiếu, đúng room_code.
insert into public.people (user_id, name, group_key, is_partner, room_code)
select u.id, 'vợ', 'FRIEND', true, 'HIEU-Y-2026'
from auth.users u
where lower(trim(u.email)) ilike 'truongnguyenminhhieu%'
  and not exists (
    select 1 from public.people p
    where p.user_id = u.id and p.name = 'vợ' and p.deleted_at is null
  );

update public.people p
set is_partner = true, room_code = 'HIEU-Y-2026', deleted_at = null
where p.name = 'vợ'
  and p.user_id in (select id from auth.users where lower(trim(email)) ilike 'truongnguyenminhhieu%');

-- 3) Nạp lại 80 kỷ niệm gốc; bỏ qua bản ghi đã có (trùng title + ngày).
insert into public.shared_events (owner_id, person_id, room_code, title, note, event_date, event_time, location, image_url)
select u.id, w.id, 'HIEU-Y-2026', v.title, v.note, v.event_date, v.event_time, v.location, v.image_url
from (select id from auth.users where lower(trim(email)) ilike 'truongnguyenminhhieu%' order by created_at limit 1) u,
     (select id from public.people
        where name = 'vợ' and deleted_at is null
          and user_id = (select id from auth.users where lower(trim(email)) ilike 'truongnguyenminhhieu%' order by created_at limit 1)
        order by created_at limit 1) w,
(values
  ('Call nhau xưa',NULL,'2021-12-15'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/f5a25547-c437-4c20-923f-7492e7420dbe/py7vz2wpaa8_1780505855061.jpg'),
  ('Hức',NULL,'2021-12-18'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/6eb4bcd3-cb93-4e09-827d-0612809ea5be/70gn22eqzss_1780505969302.jpg'),
  ('Bên nhauuuuuu',NULL,'2023-01-01'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/e4ed14cb-f438-414c-8028-0d2d3a0140bd/v5w3tdtc05c_1780506161857.jpg'),
  ('Cùng về',NULL,'2023-01-07'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/51fd5d4a-a4a0-43a5-91a2-ef9a47907ac4/8p5f2x2xban_1780506249241.jpg'),
  ('Bên nhaooo',NULL,'2023-12-28'::date,NULL,NULL,NULL),
  ('Ik chơi tết Dương',NULL,'2024-01-01'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/827bc269-1037-46ef-9238-f052213e8786/4u14es9io1p_1780505772814.jpg'),
  ('Iu em',NULL,'2024-02-29'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/760aaf0c-fd3a-4b55-b152-8155229891e0/p79m8c86y0d_1780505729602.jpg'),
  ('Ik âu dọ',NULL,'2024-03-05'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/dc944d78-a6b1-448f-b812-7eb1b665f621/lidbo7k562_1780505674339.jpg'),
  ('Chiếm bàn phím',NULL,'2024-03-12'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/e7a828b2-ff35-4c96-82dc-c07bd71213a5/9bsv67b9a4c_1779812152754.jpg'),
  ('Coi pim',NULL,'2024-05-30'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/f824eae0-d9a0-4f84-a491-a348bf57b5f2/dmmn18evzn_1780505522356.jpg'),
  ('Đi chơiii',NULL,'2024-06-02'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/a2173077-8560-43aa-86c8-f1dbecf6e8dd/sgv1p14n3pl_1780505568503.jpg'),
  ('Sn',NULL,'2024-07-16'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/bcf18c38-bafb-4d86-ba71-87b68d8adebe/ga6ozonb6bp_1780504498550.jpg'),
  ('Về nhà chồng',NULL,'2024-08-25'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/f06b55a5-f9a6-482d-bcbc-2ff65434e635/sd2ht90483_1779201986884.jpg'),
  ('Cần Giờ',NULL,'2024-09-22'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/efaf4ddb-28a8-4784-bb92-cb2384e02b85/d1afuqhhi1j_1779200561545.jpg'),
  ('Cầu Lông nè',NULL,'2024-10-11'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/df7c6a67-6c7d-45b7-910f-f17941edca7c/x5zfedwzvka_1779198189732.jpg'),
  ('Hứa bên nhao',NULL,'2024-12-12'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/4c7201d1-c278-47dc-9da2-b4beb1592481/kpwyllk3fq_1779812024487.jpg'),
  ('Valentine',NULL,'2025-02-14'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/e09b73c5-4833-46c6-b208-3e4823b66767/50rkufpevdm_1779431417186.jpg'),
  ('Đi chơi',NULL,'2025-06-09'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/0afdd9f0-1154-4b1d-8ca4-7a5ebae9a0c4/1tshcifms4r_1779431290623.jpg'),
  ('Chở Phú đi nhận bằng khen',NULL,'2025-06-13'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/1e6fbe01-dc49-46b3-ab2e-c83d1a8882e8/u2biowxaxus_1775299028566.jpg'),
  ('Sinh nhật',NULL,'2025-07-16'::date,NULL,'Bạc liêu','https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/8f6a5139-e20a-47d5-b48c-a3bc6a3810e1/ahne5pzc839_1774544309714.jpg'),
  ('Gặp blv',NULL,'2025-08-28'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/921e2b3f-d018-423a-a891-b56b720e0ed1/tc5d7b0exk_1774544205669.jpg'),
  ('Xem phim gì đớ quên ời',NULL,'2025-09-21'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/b465eb1e-bea4-4fe7-9b41-dd23eb42e62a/wvifjlu57c_1773260351154.jpg'),
  ('Khám bịnh ông nội',NULL,'2025-09-24'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/96ca5358-6142-4b93-b984-cd2acad1d42c/51xl3aza6jd_1773260119995.jpg'),
  ('Vườn',NULL,'2025-10-02'::date,NULL,NULL,NULL),
  ('Sinh nhật thầy Hoàng',NULL,'2025-10-11'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/95a7501f-6339-40a7-a6b3-54f3f63257cd/cnmaubl61x6_1774543293394.jpg'),
  ('Sinh nhật dương của vợ iu',NULL,'2025-10-13'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/6996cc25-01c2-4f12-a094-e6e225172155/m1zdidmtyl_1773260183761.jpg'),
  ('Sinh nhật âm của vợ iu',NULL,'2025-10-20'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/7eba9504-6f72-463c-9fe2-8d4e13664de0/702d1cs7wu7_1773260207378.jpg'),
  ('Ăn Hadilao',NULL,'2025-11-12'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/c5d8a69f-9079-45af-88f0-fb2021d9901c/9zol4ip40gb_1773259739273.jpg'),
  ('2 vs Nuôn lên',NULL,'2025-11-19'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/244b14f7-a4fb-43fe-a53b-b46ce2678541/a2ymsle50um_1774543476241.jpg'),
  ('Cầu hôn ở trên Playtogether',NULL,'2025-12-24'::date,NULL,NULL,NULL),
  ('Ảnh xưa',NULL,'2026-01-08'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/ff91ae7b-ac97-48e9-8857-c9a84eca08dc/yk244bvwifn_1774543702470.jpg'),
  ('Ăn nhà vợ iu',NULL,'2026-02-10'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/0f30dda0-c9f4-48a7-8055-6e4c10b5b5a1/saa0u2z755_1773258049689.jpg'),
  ('Ngày tết',NULL,'2026-02-12'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/f5500133-89aa-4bf2-b8e0-85cf1c4ad1ea/pdd11yzhrk_1774542983786.jpg'),
  ('Ngày tết',NULL,'2026-02-16'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/b848ccd1-50d5-4dfd-a5d5-5db09d5ae675/46p3c7liosl_1774542878296.jpg'),
  ('Đi chơi ở Bạc Liêu',NULL,'2026-03-01'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/4f71eb7b-1e7f-4768-8da2-18242183a494/barb7kp68a5_1773258543806.jpg'),
  ('Ảnh playto',NULL,'2026-03-09'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/d08c9be7-5f67-4cdc-8e45-efc491d2dfd5/x9l62s6i9b_1774544039503.jpg'),
  ('dssd','sds','2026-03-11'::date,NULL,NULL,NULL),
  ('Làm app Kỉ Niệm','Vui lắm lắm lắm','2026-03-11'::date,NULL,NULL,NULL),
  ('ádasd',NULL,'2026-03-11'::date,NULL,NULL,NULL),
  ('ádasd','ádasd','2026-03-11'::date,NULL,NULL,NULL),
  ('dsvsdf',NULL,'2026-03-11'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/e7af82d2-3ef9-4834-86c7-ea930d5a26cd/hjk8x8g3nqm_1773240793919.jpg'),
  ('Vợ iu sắp lên Sài Gòn',NULL,'2026-03-11'::date,NULL,'Sài Gòn',NULL),
  ('đs','ssd','2026-03-11'::date,NULL,NULL,NULL),
  ('Chìu tại Bình Tân','Nắc ảnh 2 cái h xog ik chơi vs tụi Phúc Vy xiệt mệt dìa nhủ h 2 vc thủ thỉ hú hí riêng đi nạp NLw mong chờ cái típ theo 🫣','2026-03-12'::date,NULL,'Đi ăn bún bò cùng vợ chồng mik nhaaaa','https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/7bb82fa9-0570-4a11-88f9-d7f67740952c/49f88ca9-8552-467e-be62-e74a139948d6/8abzm85idi9_1773323490040.jpg'),
  ('Ngày đầu tiên','Đụ đã quá','2026-03-12'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/f698b861-5478-4447-a2dd-06208019b787/7too20brot_1773298144786.jpg'),
  ('Đi xem phim','Đồ tồi 😡 chụp hình xấu vãi cả đ*i😭😭.  Được cái pim ok còn a thì như c*c . Chấm phục vụ 1⭐😡😡😡😡 ...mà cặc thì ngon','2026-03-13'::date,NULL,'SG_ Bình Tân','https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/7bb82fa9-0570-4a11-88f9-d7f67740952c/ebc0074b-c3c5-4156-9989-7a1f9b7be235/138v38olc8ka_1773400593382.jpg'),
  ('Đi chơi vs Thư Quân','Cx nhon nhở 😍 có cơ hội sẽ ik lại quán hoa" Ngọc Ý" q5 -2 đứa😋😋😋','2026-03-14'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/7bb82fa9-0570-4a11-88f9-d7f67740952c/8f8237ca-0652-49b3-8f37-4000e3014921/jgfvp84d5ip_1773575330573.jpg'),
  ('Chìu tại Bình Tân','Ảnh chở ik chơi óoi----> " đi barrrr" nhoaaaaa','2026-03-14'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/7bb82fa9-0570-4a11-88f9-d7f67740952c/b9d23248-7ba9-4dfd-bcd9-83b0333cae52/u2bbygajvb_1773484052057.jpg'),
  ('Không gian riêng','Nay chỉ có 2 vợ chồng thui 😚😉 ở trọ coi pim minian và câu chuyện đồ chơi xăm òi còn được chồng iu dẫn ik ăn lẩu cá nhon quáaaaaaa 😍😍😍😍 cặp đôi song bot mãi đỉnh _ cập nhật là hiện tại đã 5h vẫn còn thức coi pim tận hưởng đêm cúi lần thăm chồng đầu tiên ngaa 👩‍❤️‍💋‍👨📺🎬','2026-03-15'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/7bb82fa9-0570-4a11-88f9-d7f67740952c/16cca24a-2d19-4279-91b5-72d78f77591c/b63jzyevsv_1773697903696.jpg'),
  ('Vợ đi òiii huhu',NULL,'2026-03-16'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/c324cf5e-d2f7-4586-bbb4-f8e78de0e2a5/0n5b9flgvx1_1773676920791.jpg'),
  ('Ngày tạm biệt òi - kết thúc lần thăm đầu tiên chũi iu xaaaaa','Chở vợ ik nhìu quá chương anhhhh❤️ ăn mì cay nò, coi pim Châu Tinh Trì hay á nha ủa ờ he hk thấy chồng iu ỉaaaa ta 🤔 s ns mắc dữ lém_" đánh dấu chủ quyền" mong lò ôm k mảnh vải 🫂và sẽ cùng nhau mặc áo cưới, cùng nhau khoát tay vào lễ đường _ PHẢI LÀ CỦA NHAU ÁAAA 😊🤵👰👩‍❤️‍👨👫💐','2026-03-16'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/7bb82fa9-0570-4a11-88f9-d7f67740952c/84175edb-f74e-4033-ba67-4ff6fbed2c97/pod8bq7vhlj_1773698523112.jpg'),
  ('Ngày đầu đi học sau khi vợ đi','Chán quá hong muốn đi','2026-03-17'::date,NULL,'SGU',NULL),
  ('Chuỗi Ngày xa nhau đầu tiên sau lần gặp gỡ','H phải coi pim onl òiiii 🥹chơi game có thể trầm cảm 😱😱 còn dịu dàng vs e 😚😚','2026-03-17'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/7bb82fa9-0570-4a11-88f9-d7f67740952c/7aebe04c-a127-49ed-90f1-66e1bdd5dba8/e40u6qpb717_1773805297012.jpg'),
  ('Ngày t2','Anh làm j thế','2026-03-18'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/7bb82fa9-0570-4a11-88f9-d7f67740952c/31cfca52-b6e2-4814-9514-78f26de5e810/ppm6xbthqzj_1773861723131.jpg'),
  ('Cày game choa cục dàng',NULL,'2026-03-19'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/81ae4117-3886-45d6-ac19-86f3d8bb4b85/ynwl1japv8_1773929563030.jpg'),
  ('Ik chơi k có anh','Team play hỏng có a òi _ mong bên nhau ik chơi nhìu_ cùng ăn mì','2026-03-20'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/7bb82fa9-0570-4a11-88f9-d7f67740952c/09ba007e-7dc7-408b-9a3f-1917cc84ec49/1mp04vpnmrr_1774029799137.jpg'),
  ('Làm app BoyLove',NULL,'2026-03-20'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/cca638c7-bbf9-4ee5-abe2-0fbfee8ef02b/za2nr0ojjl_1774542776127.jpg'),
  ('Chuẩn bị đi lèm','2 vchong chơi game cả ngày nhuôn','2026-03-22'::date,NULL,NULL,NULL),
  ('Đi Trà Vinh','Dễ thương dữ dọ','2026-03-23'::date,NULL,NULL,NULL),
  ('Kí ức....','Kí ức " dâm" em chịu a Híu nhuôn 🤐,
nhớ a Híu khi xưa 🥹','2026-03-23'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/7bb82fa9-0570-4a11-88f9-d7f67740952c/e928761b-0603-4305-b76c-480f8da488b4/n4pr3sp46y_1774282982458.jpg'),
  ('Teeee',NULL,'2026-03-24'::date,NULL,NULL,NULL),
  ('Lời hứa','Phải nhớ phải làm được ó','2026-03-24'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/7bb82fa9-0570-4a11-88f9-d7f67740952c/7ae0a780-775f-4138-8bac-4c4a857f8d4d/v096qapp8cm_1774372730530.jpg'),
  ('Ngày nào cx callll','Anh làm gì théeeee','2026-03-29'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/7bb82fa9-0570-4a11-88f9-d7f67740952c/17ee8313-90b1-4fc2-ad66-1640527da9f7/5asfkxwav3e_1774773017866.jpg'),
  ('Bên em',NULL,'2026-04-01'::date,NULL,'Dương Quang Đông, Phường Hòa Thuận, Tỉnh Vĩnh Long, Việt Nam',NULL),
  ('Ăn jollibeeeeeee',NULL,'2026-04-12'::date,NULL,'Jollibe Trà Vinh','https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/7e8e2db3-0fd4-4fc0-9e78-b681e5895b8c/fga5v0o9jtg_1776077931956.jpg'),
  ('Trở về Trà Vinh òi',NULL,'2026-04-13'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/10e1a6e5-c4a5-48a5-8136-07f485641ed4/eafa633bnag_1778842181609.jpg'),
  ('Lên Sài Gòn huhu',NULL,'2026-04-13'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/9d4bffe4-33f9-4ce5-9c68-a1b985a45583/gbpvandaudp_1776077860403.jpg'),
  ('Cuộc gặp hội ngộ thứ haiiiiii','1/4/2026_13/4/2026. Dù k ngắn nhưng vẫn cảm thấy k đủ. Rất rất vui rất rất nhiều tiếng cười. Rất nhiều thứ lần đầu tiên làm cùng nhau luôn. Cùng thả dìu🪁 cùng đi ăn bánh canh 3h uốn cf 4h sáng🍜☕, cùng đi ao bờ ôm qwn 🍧, cùng nhau dự ngày chụp hình của 2💐 cùng 2 ăn uống cùng ở chung công khai 👩‍❤️‍👨😌Cảm ơn anh đã thương e nhiều ❤️. KIM Ý NĂM 22 CHỦI RẤT IU ANHHHHHH😘😘❤️❤️❤️💕💋','2026-04-13'::date,NULL,'Trà Vinh','https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/7bb82fa9-0570-4a11-88f9-d7f67740952c/d28ab299-a31b-49c8-8494-91b64375020d/62x4mah1p2s_1776089880709.jpg'),
  ('Những ngày đi làm nò',NULL,'2026-04-24'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/f1eab75c-1b59-4c44-8923-c7f17e54107d/6fj9twl3lyh_1777019872970.jpg'),
  ('Call nhớ nhau quá',NULL,'2026-04-30'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/ba3dce93-9693-4ea4-8e8b-6b0bf6830eb9/23eq4l5wa6f_1778841945379.jpg'),
  ('Nhớ anhhh','Bao lâu sẽ được như dị nữa ta','2026-05-01'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/7bb82fa9-0570-4a11-88f9-d7f67740952c/954a04ec-b565-4fb1-b706-72bba4064f22/fdh14ia9elt_1779893048020.jpg'),
  ('Con của chúng mình',NULL,'2026-05-03'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/96d518aa-0871-46c5-bb75-193165a681f8/10v4xw4a64rc_1778841685012.jpg'),
  ('2 tốt nghiệp',NULL,'2026-05-15'::date,NULL,NULL,NULL),
  ('Bên emmmmmmm',NULL,'2026-05-18'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/63aad30d-7ecf-4f56-be3a-6a40dd53e9e1/96q6gvxb1x_1779100336983.jpg'),
  ('Gặp đc tí nồ òi',NULL,'2026-05-18'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/7bb82fa9-0570-4a11-88f9-d7f67740952c/48c40b1f-f881-4951-9d91-b24ae7a8afca/39lhfk6pizh_1779101236150.jpg'),
  ('Bên nhau',NULL,'2026-05-20'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/9fb8655f-d70f-4bd5-9628-0c5ec98373a3/vmjeodyoa_1779430944866.jpg'),
  ('Về Sg .','Nhớ vợ yêu lắm','2026-05-25'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/bc98e69e-c4a7-45de-ab9d-60a784cb7dff/964aemeuftk_1779717858791.jpg'),
  ('Call bên nhau',NULL,'2026-05-27'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/303f59ed-e146-47c0-bd51-67e5ac33bdbf/lj70njdl7o9_1779820856790.jpg'),
  ('Calllll',NULL,'2026-05-29'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/2774de86-a844-409b-8d00-d7e0d9fcb504/0enq30wl0ma8_1780504216311.jpg'),
  ('Call nò',NULL,'2026-05-31'::date,NULL,NULL,'https://xhgpxtuzocqqqgsdfqig.supabase.co/storage/v1/object/public/media/73b288a0-48e5-4d6a-86ad-ca5f4cb79848/a38d83ca-8f01-4828-aeda-43cc34f7bd50/34kt4g6nqq_1780504171052.jpg')
) as v(title, note, event_date, event_time, location, image_url)
where not exists (
  select 1 from public.shared_events se
  where se.deleted_at is null
    and se.event_date = v.event_date
    and lower(trim(se.title)) = lower(trim(v.title))
);

-- 4) Gắn kỷ niệm mồ côi (person_id null) về lại người "vợ" của Hiếu.
update public.shared_events se
set person_id = (
  select p.id from public.people p
  where p.name = 'vợ' and p.deleted_at is null
    and p.user_id = se.owner_id
  order by p.created_at limit 1
)
where se.person_id is null
  and se.deleted_at is null
  and se.owner_id in (select id from auth.users where lower(trim(email)) ilike 'truongnguyenminhhieu%');

-- 5) Chia sẻ 2 chiều.
insert into public.shared_partners (user_id, partner_email)
select u.id, p.email
from auth.users u
join (values
  ('truongnguyenminhhieu1000@gmail.com', 'nguyenkimy1302.gr@gmail.com'),
  ('truongnguyenminhhieu100@gmail.com', 'nguyenkimy1302.gr@gmail.com'),
  ('nguyenkimy1302.gr@gmail.com', 'truongnguyenminhhieu1000@gmail.com'),
  ('nguyenkimy1302.gr@gmail.com', 'truongnguyenminhhieu100@gmail.com')
) as p(owner_email, email) on lower(trim(u.email)) = lower(p.owner_email)
on conflict (user_id, partner_email) do update set deleted_at = null;
