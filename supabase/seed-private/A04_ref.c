#include <stdio.h>

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 1;
    int arr[100];
    for (int i = 0; i < n; i++) scanf("%d", &arr[i]);
    int maxVal = arr[0];
    int maxIdx = 0;
    for (int i = 1; i < n; i++) {
        if (arr[i] > maxVal) {
            maxVal = arr[i];
            maxIdx = i;
        }
    }
    printf("max=%d idx=%d\n", maxVal, maxIdx);
    return 0;
}
