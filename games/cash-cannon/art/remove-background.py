"""Remove the neutral checkerboard from the generated CashCat reference.

The user authorized local background removal after the generator twice returned
RGB checkerboards. Keep the unmodified source next to this script for repeatability.
"""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import binary_fill_holes

root = Path(__file__).resolve().parent
source = root / 'cashcat-generated.png'
target = root.parent / 'assets' / 'cashcat.png'
if not source.exists():
    source.write_bytes(target.read_bytes())
rgb = np.array(Image.open(source).convert('RGB'))
# An explicit silhouette protects the nearly neutral white ears and forehead.
# Color keying alone would remove that fur along with the checkerboard.
outline = np.array([
 (356,37),(382,59),(455,100),(523,90),(600,94),(689,111),(788,85),(849,62),
 (837,112),(800,159),(782,207),(789,250),(821,284),(885,345),(944,435),
 (992,544),(1035,626),(1065,691),(1071,773),(1057,867),(1006,932),
 (926,1007),(839,1054),(787,1082),(776,1115),(775,1175),(759,1211),
 (716,1238),(682,1236),(657,1220),(649,1192),(667,1154),(679,1112),
 (678,1095),(629,1084),(534,1086),(491,1078),(469,1111),(444,1152),
 (410,1185),(379,1197),(345,1193),(326,1179),(306,1173),(284,1158),
 (269,1137),(274,1108),(302,1084),(358,1066),(413,1052),(427,1012),
 (425,997),(366,1011),(321,1026),(279,1027),(259,1009),(268,984),
 (299,962),(351,946),(398,930),(428,909),(426,841),(412,775),(416,701),
 (404,647),(405,583),(414,530),(421,481),(420,453),(396,426),(376,381),
 (361,328),(353,280),(360,236),(370,192),(376,168),(385,154),(374,129),(365,89)
 ], dtype=np.int32)
silhouette = np.zeros(rgb.shape[:2], np.uint8)
cv2.fillPoly(silhouette, [outline], 1)
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31,31))
inside = cv2.erode(silhouette, kernel)
outside = cv2.dilate(silhouette, kernel)
gc = np.where(silhouette, cv2.GC_PR_FGD, cv2.GC_PR_BGD).astype(np.uint8)
gc[outside == 0] = cv2.GC_BGD
gc[inside == 1] = cv2.GC_FGD
cv2.grabCut(rgb, gc, None, np.zeros((1,65)), np.zeros((1,65)), 5, cv2.GC_INIT_WITH_MASK)
mask = ((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD)).astype(np.uint8)
mask = binary_fill_holes(mask).astype(np.uint8)
chroma = rgb.max(axis=2).astype(float) - rgb.min(axis=2)
edge_depth = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
# GrabCut can attach pale checkerboard squares to the outline. Key only the
# narrow outer band so neutral fur inside the head stays intact.
mask[(edge_depth < 15) & (chroma < 7)] = 0
# Trace the pale head edge directly: its fur shares the white squares' color.
head_outline = np.array([
 (357,40),(370,56),(399,79),(428,96),(448,104),(476,101),
 (503,97),(526,92),(551,92),(578,95),(609,98),(642,103),
 (671,111),(693,114),(719,110),(747,101),(778,89),(808,77),
 (842,66),(834,88),(821,108),(803,130),(782,149),(781,164),
 (784,190),(784,213),(790,236),(806,261),(355,261),(359,233),
 (367,209),(375,188),(388,162),(383,143),(377,119),(367,89),
 (359,64)
 ], dtype=np.int32)
head = np.zeros_like(mask)
cv2.fillPoly(head, [head_outline], 1)
mask[:260] = head[:260]
mask = cv2.medianBlur(mask, 7)
mask = binary_fill_holes(mask).astype(np.uint8)
_, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
mask = (labels == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
alpha = cv2.GaussianBlur(mask.astype(np.float32), (3, 3), .55)
rgba = np.dstack([rgb, np.round(alpha * 255).astype(np.uint8)])
Image.fromarray(rgba).save(target, optimize=True)
preview = Image.new('RGBA', (1254, 1254), '#10201a')
preview.alpha_composite(Image.fromarray(rgba))
preview.convert('RGB').save(root / 'qa-cutout.png')
print(f'Saved {target}: RGBA, {np.count_nonzero(rgba[:,:,3] == 0)} fully transparent pixels')
