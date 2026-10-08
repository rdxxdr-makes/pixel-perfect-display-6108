DROP POLICY IF EXISTS "comments readable" ON public.comments;
CREATE POLICY "comments readable" ON public.comments FOR SELECT TO authenticated
USING (public.can_view_user(auth.uid(), (SELECT p.user_id FROM public.posts p WHERE p.id = post_id)));
DROP POLICY IF EXISTS "likes readable" ON public.likes;
CREATE POLICY "likes readable" ON public.likes FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can_view_user(auth.uid(), (SELECT p.user_id FROM public.posts p WHERE p.id = post_id)));
DROP POLICY IF EXISTS "follows readable" ON public.follows;
CREATE POLICY "follows readable" ON public.follows FOR SELECT TO authenticated
USING (follower_id = auth.uid() OR following_id = auth.uid() OR (status = 'accepted' AND public.can_view_user(auth.uid(), following_id)));
DROP POLICY IF EXISTS "media public read" ON storage.objects;
CREATE POLICY "media signed-in read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'media');