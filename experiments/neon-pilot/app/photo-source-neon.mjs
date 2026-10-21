// In a migrated record a managed photo path takes precedence over location's
// generic Unsplash illustration, EVEN WHEN the private file cannot be loaded.
// Otherwise a failing private download disguises itself as a wrong photograph.
export function activityPhotoForPreview(activity,location){
  if(activity?.photo_path)return activity.photo_url||'';
  return activity?.photo_url||location?.photo_url||'';
}
